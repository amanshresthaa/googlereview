import { prisma } from "@/lib/db"
import type { Job } from "@prisma/client"
import { z } from "zod"
import { getAccessTokenForOrg } from "@/lib/google/oauth"
import {
  formatAddressSummary,
  listAccounts,
  listLocations,
  listReviews,
  parseAccountId,
  parseLocationIds,
  starRatingToInt,
  updateReviewReply,
  getReview,
} from "@/lib/google/gbp"
import { extractMentionsAndHighlights } from "@/lib/reviews/mentions"
import { enqueueJob } from "@/lib/jobs/queue"
import { evidenceSnapshotSchema, generateDraftText, verifyDraftWithLlm } from "@/lib/ai/draft"
import { runDeterministicVerifier } from "@/lib/verifier/deterministic"
import { MAX_GOOGLE_REPLY_CHARS } from "@/lib/policy"
import { NonRetryableError, RetryableJobError } from "@/lib/jobs/errors"
import {
  breakerPrecheckOrThrow,
  breakerRecordFailure,
  breakerRecordSuccess,
  consumeDailyBudgetOrThrow,
  enforceCooldownOrThrow,
  setCooldownAfterSuccess,
} from "@/lib/jobs/reliability"

export async function handleJob(job: Job, opts?: { signal?: AbortSignal }) {
  // Optional per-invocation signal used for bounded fast-path execution.
  // Normal background worker execution does not pass a signal.
  // Note: only AI upstream calls currently use the signal.
  const signal = opts?.signal

  switch (job.type) {
    case "SYNC_LOCATIONS":
      return handleSyncLocations(job)
    case "SYNC_REVIEWS":
      return handleSyncReviews(job)
    case "GENERATE_DRAFT":
      return handleGenerateDraft(job, signal)
    case "VERIFY_DRAFT":
      return handleVerifyDraft(job, signal)
    case "POST_REPLY":
      return handlePostReply(job)
    default:
      throw new Error(`Unhandled job type: ${job.type}`)
  }
}

const syncReviewsPayloadSchema = z.object({ locationId: z.string().min(1) }).passthrough()
const generateDraftPayloadSchema = z
  .object({
    reviewId: z.string().min(1),
    budgetOverride: z
      .object({
        enabled: z.boolean(),
        reason: z.string().nullable().optional(),
      })
      .optional(),
  })
  .passthrough()
const verifyDraftPayloadSchema = z
  .object({
    draftReplyId: z.string().min(1),
    budgetOverride: z
      .object({
        enabled: z.boolean(),
        reason: z.string().nullable().optional(),
      })
      .optional(),
  })
  .passthrough()
const postReplyPayloadSchema = z.object({
  draftReplyId: z.string().min(1),
  actorUserId: z.string().min(1).optional(),
}).passthrough()

async function handleSyncLocations(job: Job) {
  const { accessToken } = await getAccessTokenForOrg(job.orgId)

  const accountsKey = "GOOGLE:listAccounts"
  await breakerPrecheckOrThrow({ orgId: job.orgId, upstreamKey: accountsKey })
  let accounts
  try {
    accounts = await listAccounts(accessToken)
    await breakerRecordSuccess({ orgId: job.orgId, upstreamKey: accountsKey })
  } catch (err) {
    await breakerRecordFailure({ orgId: job.orgId, upstreamKey: accountsKey })
    throw err
  }
  for (const account of accounts) {
    const accountId = parseAccountId(account.name)
    const locationsKey = "GOOGLE:listLocations"
    await breakerPrecheckOrThrow({ orgId: job.orgId, upstreamKey: locationsKey })
    let locations
    try {
      locations = await listLocations(accessToken, account.name)
      await breakerRecordSuccess({ orgId: job.orgId, upstreamKey: locationsKey })
    } catch (err) {
      await breakerRecordFailure({ orgId: job.orgId, upstreamKey: locationsKey })
      throw err
    }

    for (const loc of locations) {
      const locationId = parseLocationIds(loc.name).locationId
      const displayName = loc.title?.trim() || `Location ${locationId}`
      const addressSummary = formatAddressSummary(loc)

      await prisma.location.upsert({
        where: {
          orgId_googleAccountId_googleLocationId: {
            orgId: job.orgId,
            googleAccountId: accountId,
            googleLocationId: locationId,
          },
        },
        update: {
          displayName,
          storeCode: loc.storeCode ?? undefined,
          addressSummary: addressSummary ?? undefined,
        },
        create: {
          orgId: job.orgId,
          googleAccountId: accountId,
          googleLocationId: locationId,
          displayName,
          storeCode: loc.storeCode ?? undefined,
          addressSummary: addressSummary ?? undefined,
          enabled: false,
        },
      })
    }
  }
}

async function handleSyncReviews(job: Job) {
  const payload = syncReviewsPayloadSchema.parse(job.payload)

  const location = await prisma.location.findFirst({
    where: { id: payload.locationId, orgId: job.orgId, enabled: true },
  })
  if (!location) return

  const settings = await prisma.orgSettings.findUnique({ where: { orgId: job.orgId } })
  const mentionKeywords = settings?.mentionKeywords ?? []
  const autoDraftEnabled = settings?.autoDraftEnabled ?? true
  const autoDraftRatings = new Set(settings?.autoDraftForRatings ?? [])

  const { accessToken } = await getAccessTokenForOrg(job.orgId)

  const locationName = `accounts/${location.googleAccountId}/locations/${location.googleLocationId}`
  let pageToken: string | undefined
  let pageCount = 0

  while (pageCount < 20) {
    const listKey = "GOOGLE:listReviews"
    await breakerPrecheckOrThrow({ orgId: job.orgId, upstreamKey: listKey })
    let page
    try {
      page = await listReviews(accessToken, locationName, pageToken)
      await breakerRecordSuccess({ orgId: job.orgId, upstreamKey: listKey })
    } catch (err) {
      await breakerRecordFailure({ orgId: job.orgId, upstreamKey: listKey })
      throw err
    }
    const { reviews, nextPageToken } = page
    if (reviews.length === 0) break
    pageCount += 1

    const names = reviews.map((r) => r.name)
    const existing = await prisma.review.findMany({
      where: { googleReviewName: { in: names } },
      select: { googleReviewName: true },
    })
    const existingSet = new Set(existing.map((e) => e.googleReviewName))

    for (const r of reviews) {
      const star = starRatingToInt(r.starRating)
      const comment = r.comment ?? null
      const { mentions } = extractMentionsAndHighlights(comment, mentionKeywords)

      const upserted = await prisma.review.upsert({
        where: { googleReviewName: r.name },
        update: {
          starRating: star,
          comment,
          createTime: new Date(r.createTime),
          updateTime: new Date(r.updateTime),
          reviewerDisplayName: r.reviewer?.displayName ?? undefined,
          reviewerIsAnonymous: Boolean(r.reviewer?.isAnonymous),
          googleReplyComment: r.reviewReply?.comment ?? undefined,
          googleReplyUpdateTime: r.reviewReply?.updateTime
            ? new Date(r.reviewReply.updateTime)
            : undefined,
          mentions,
          locationId: location.id,
          orgId: job.orgId,
        },
        create: {
          orgId: job.orgId,
          locationId: location.id,
          googleReviewName: r.name,
          googleReviewId: r.reviewId,
          starRating: star,
          comment,
          createTime: new Date(r.createTime),
          updateTime: new Date(r.updateTime),
          reviewerDisplayName: r.reviewer?.displayName ?? undefined,
          reviewerIsAnonymous: Boolean(r.reviewer?.isAnonymous),
          googleReplyComment: r.reviewReply?.comment ?? undefined,
          googleReplyUpdateTime: r.reviewReply?.updateTime
            ? new Date(r.reviewReply.updateTime)
            : undefined,
          mentions,
        },
      })

      const isNew = !existingSet.has(r.name)
      const isUnanswered = !r.reviewReply?.comment
      if (isNew && isUnanswered && autoDraftEnabled && autoDraftRatings.has(star)) {
        await enqueueJob({
          orgId: job.orgId,
          type: "GENERATE_DRAFT",
          payload: { reviewId: upserted.id },
          dedupKey: `review:${upserted.id}`,
        })
      }
    }

    if (!nextPageToken) break
    pageToken = nextPageToken
  }

  await prisma.location.update({
    where: { id: location.id },
    data: { lastReviewsSyncAt: new Date() },
  })
}

async function handleGenerateDraft(job: Job, signal?: AbortSignal) {
  const payload = generateDraftPayloadSchema.parse(job.payload)

  const review = await prisma.review.findFirst({
    where: { id: payload.reviewId, orgId: job.orgId },
    include: { location: true },
  })
  if (!review) return

  await enforceCooldownOrThrow({ orgId: job.orgId, scope: "GENERATE_DRAFT", key: review.id })
  await consumeDailyBudgetOrThrow({
    orgId: job.orgId,
    scope: "AI",
    bypass: payload.budgetOverride?.enabled === true,
  })

  const settings = await prisma.orgSettings.findUnique({ where: { orgId: job.orgId } })
  const provider = settings?.aiProvider ?? "OPENAI"
  const upstreamKey = `${provider}:generate`
  await breakerPrecheckOrThrow({ orgId: job.orgId, upstreamKey })
  const mentionKeywords = settings?.mentionKeywords ?? []
  const { mentions, highlights } = extractMentionsAndHighlights(review.comment, mentionKeywords)

  // Keep Review.mentions as the canonical source for inbox filters.
  if (mentions.join("|") !== review.mentions.join("|")) {
    await prisma.review.update({
      where: { id: review.id },
      data: { mentions },
    })
  }

  const evidence = {
    starRating: review.starRating,
    comment: review.comment ?? null,
    reviewerDisplayName: review.reviewerDisplayName ?? null,
    reviewerIsAnonymous: review.reviewerIsAnonymous,
    locationDisplayName: review.location.displayName,
    createTime: review.createTime.toISOString(),
    highlights,
    mentionKeywords,
    tone: {
      preset: settings?.tonePreset ?? "friendly",
      customInstructions: settings?.toneCustomInstructions ?? null,
    },
  }

  let draftText = ""
  try {
    draftText = await generateDraftText({
      provider,
      evidence,
      signal,
    })
    await breakerRecordSuccess({ orgId: job.orgId, upstreamKey })
  } catch (err) {
    await breakerRecordFailure({ orgId: job.orgId, upstreamKey })
    throw err
  }

  const maxVersion = await prisma.draftReply.aggregate({
    where: { reviewId: review.id },
    _max: { version: true },
  })
  const nextVersion = (maxVersion._max.version ?? 0) + 1

  const created = await prisma.draftReply.create({
    data: {
      orgId: job.orgId,
      reviewId: review.id,
      version: nextVersion,
      text: draftText,
      origin: "AUTO",
      status: "NEEDS_APPROVAL",
      evidenceSnapshotJson: evidence as never,
    },
  })

  await prisma.review.update({
    where: { id: review.id },
    data: { currentDraftReplyId: created.id },
  })

  await enqueueJob({
    orgId: job.orgId,
    type: "VERIFY_DRAFT",
    payload: { draftReplyId: created.id },
    dedupKey: `draft:${created.id}`,
  })

  await setCooldownAfterSuccess({ orgId: job.orgId, scope: "GENERATE_DRAFT", key: review.id })
}

async function handleVerifyDraft(job: Job, signal?: AbortSignal) {
  const payload = verifyDraftPayloadSchema.parse(job.payload)

  const draft = await prisma.draftReply.findFirst({
    where: { id: payload.draftReplyId, orgId: job.orgId },
    include: { review: { include: { location: true } } },
  })
  if (!draft) return

  // Verify latest only: if this draft is no longer current, complete the job without changes.
  if (draft.review.currentDraftReplyId && draft.review.currentDraftReplyId !== draft.id) {
    return
  }

  await enforceCooldownOrThrow({ orgId: job.orgId, scope: "VERIFY_DRAFT", key: draft.id })
  await consumeDailyBudgetOrThrow({
    orgId: job.orgId,
    scope: "AI",
    bypass: payload.budgetOverride?.enabled === true,
  })

  const evidence = evidenceSnapshotSchema.parse(draft.evidenceSnapshotJson)
  const settings = await prisma.orgSettings.findUnique({ where: { orgId: job.orgId } })
  const provider = settings?.aiProvider ?? "OPENAI"
  const upstreamKey = `${provider}:verify`
  await breakerPrecheckOrThrow({ orgId: job.orgId, upstreamKey })

  const deterministic = runDeterministicVerifier({
    evidenceText: String(evidence?.comment ?? ""),
    draftText: draft.text,
  })

  // Fail safe: if the LLM verifier returns invalid JSON, we block publishing rather than retrying forever.
  // User can re-run verifier from the UI to attempt again.
  let llm: { pass: boolean; violations: Array<{ code: string; message: string; snippet?: string }>; suggestedRewrite?: string } =
    {
      pass: false,
      violations: [{ code: "VERIFIER_ERROR", message: "Verifier could not be completed. Please retry." }],
    }
  try {
    llm = await verifyDraftWithLlm({ provider, evidence, draftText: draft.text, signal })
    await breakerRecordSuccess({ orgId: job.orgId, upstreamKey })
  } catch (err) {
    await breakerRecordFailure({ orgId: job.orgId, upstreamKey })
    if (err instanceof RetryableJobError) {
      throw err
    }
    // Non-upstream verifier failures are treated as a blocking verifier result (fail safe).
    llm = {
      pass: false,
      violations: [{ code: "VERIFIER_ERROR", message: "Verifier returned an invalid response. Please retry." }],
    }
  }

  const pass = deterministic.pass && llm.pass
  await prisma.draftReply.update({
    where: { id: draft.id },
    data: {
      status: pass ? "READY" : "BLOCKED_BY_VERIFIER",
      verifierResultJson: { deterministic, llm } as never,
    },
  })

  await setCooldownAfterSuccess({ orgId: job.orgId, scope: "VERIFY_DRAFT", key: draft.id })
}

async function handlePostReply(job: Job) {
  const payload = postReplyPayloadSchema.parse(job.payload)

  const draft = await prisma.draftReply.findFirst({
    where: { id: payload.draftReplyId, orgId: job.orgId },
    include: { review: { include: { location: true } } },
  })
  if (!draft) return

  const review = draft.review
  // Post reply must post current: if this draft isn't current anymore, fail non-retryable.
  if (review.currentDraftReplyId && review.currentDraftReplyId !== draft.id) {
    throw new NonRetryableError("DRAFT_STALE", "Draft is stale.")
  }
  if (review.googleReplyComment) {
    await prisma.draftReply.update({
      where: { id: draft.id },
      data: { status: "POSTED" },
    })
    return
  }

  if (draft.status !== "READY") throw new NonRetryableError("DRAFT_NOT_READY", "Draft is not READY.")

  const trimmed = draft.text.trim()
  if (trimmed.length > MAX_GOOGLE_REPLY_CHARS) {
    throw new NonRetryableError("BAD_REQUEST", "Reply too long for Google.")
  }

  await consumeDailyBudgetOrThrow({ orgId: job.orgId, scope: "POST_REPLY" })
  const { accessToken } = await getAccessTokenForOrg(job.orgId)

  // Re-check on Google to avoid overwriting an existing reply.
  const upstreamKey = "GOOGLE:updateReply"
  await breakerPrecheckOrThrow({ orgId: job.orgId, upstreamKey })
  let remote
  try {
    remote = await getReview(accessToken, review.googleReviewName)
    await breakerRecordSuccess({ orgId: job.orgId, upstreamKey })
  } catch (err) {
    await breakerRecordFailure({ orgId: job.orgId, upstreamKey })
    throw err
  }
  if (remote.reviewReply?.comment) {
    await prisma.review.update({
      where: { id: review.id },
      data: {
        googleReplyComment: remote.reviewReply.comment,
        googleReplyUpdateTime: remote.reviewReply.updateTime
          ? new Date(remote.reviewReply.updateTime)
          : undefined,
      },
    })
    await prisma.draftReply.update({
      where: { id: draft.id },
      data: { status: "POSTED" },
    })
    return
  }

  let updated: { comment?: string; updateTime?: string }
  try {
    updated = await updateReviewReply(accessToken, review.googleReviewName, trimmed)
    await breakerRecordSuccess({ orgId: job.orgId, upstreamKey })
  } catch (err) {
    await breakerRecordFailure({ orgId: job.orgId, upstreamKey })
    throw err
  }

  await prisma.$transaction(async (tx) => {
    await tx.review.update({
      where: { id: review.id },
      data: {
        googleReplyComment: updated.comment ?? trimmed,
        googleReplyUpdateTime: updated.updateTime ? new Date(updated.updateTime) : new Date(),
      },
    })
    await tx.draftReply.update({
      where: { id: draft.id },
      data: { status: "POSTED" },
    })
    await tx.auditLog.create({
      data: {
        orgId: job.orgId,
        actorUserId: payload.actorUserId ?? "system",
        action: "REPLY_POSTED",
        entityType: "Review",
        entityId: review.id,
        metadataJson: { googleReviewName: review.googleReviewName } as never,
      },
    })
  })
}
