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
import { NonRetryableError } from "@/lib/jobs/errors"

export async function handleJob(job: Job) {
  switch (job.type) {
    case "SYNC_LOCATIONS":
      return handleSyncLocations(job)
    case "SYNC_REVIEWS":
      return handleSyncReviews(job)
    case "GENERATE_DRAFT":
      return handleGenerateDraft(job)
    case "VERIFY_DRAFT":
      return handleVerifyDraft(job)
    case "POST_REPLY":
      return handlePostReply(job)
    default:
      throw new Error(`Unhandled job type: ${job.type}`)
  }
}

const syncReviewsPayloadSchema = z.object({ locationId: z.string().min(1) })
const generateDraftPayloadSchema = z.object({ reviewId: z.string().min(1) })
const verifyDraftPayloadSchema = z.object({ draftReplyId: z.string().min(1) })
const postReplyPayloadSchema = z.object({
  draftReplyId: z.string().min(1),
  actorUserId: z.string().min(1).optional(),
})

async function handleSyncLocations(job: Job) {
  const { accessToken } = await getAccessTokenForOrg(job.orgId)

  const accounts = await listAccounts(accessToken)
  for (const account of accounts) {
    const accountId = parseAccountId(account.name)
    const locations = await listLocations(accessToken, account.name)

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
    const { reviews, nextPageToken } = await listReviews(accessToken, locationName, pageToken)
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

async function handleGenerateDraft(job: Job) {
  const payload = generateDraftPayloadSchema.parse(job.payload)

  const review = await prisma.review.findFirst({
    where: { id: payload.reviewId, orgId: job.orgId },
    include: { location: true },
  })
  if (!review) return

  const settings = await prisma.orgSettings.findUnique({ where: { orgId: job.orgId } })
  const provider = settings?.aiProvider ?? "OPENAI"
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

  const draftText = await generateDraftText({
    provider,
    evidence,
  })

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
  })
}

async function handleVerifyDraft(job: Job) {
  const payload = verifyDraftPayloadSchema.parse(job.payload)

  const draft = await prisma.draftReply.findFirst({
    where: { id: payload.draftReplyId, orgId: job.orgId },
    include: { review: { include: { location: true } } },
  })
  if (!draft) return

  const evidence = evidenceSnapshotSchema.parse(draft.evidenceSnapshotJson)
  const settings = await prisma.orgSettings.findUnique({ where: { orgId: job.orgId } })
  const provider = settings?.aiProvider ?? "OPENAI"

  const deterministic = runDeterministicVerifier({
    evidenceText: String(evidence?.comment ?? ""),
    draftText: draft.text,
  })

  // Fail safe: if the LLM verifier returns invalid JSON, we block publishing rather than retrying forever.
  // User can re-run verifier from the UI to attempt again.
  let llm: { pass: boolean; violations: Array<{ code: string; message: string; snippet?: string }>; suggestedRewrite?: string } =
    { pass: false, violations: [{ code: "VERIFIER_ERROR", message: "Verifier did not return valid JSON. Please run verifier again." }] }
  try {
    llm = await verifyDraftWithLlm({
      provider,
      evidence,
      draftText: draft.text,
    })
  } catch (err) {
    llm = {
      pass: false,
      violations: [
        {
          code: "VERIFIER_ERROR",
          message:
            err instanceof Error
              ? `Verifier error: ${err.message}`
              : `Verifier error: ${String(err)}`,
        },
      ],
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
}

async function handlePostReply(job: Job) {
  const payload = postReplyPayloadSchema.parse(job.payload)

  const draft = await prisma.draftReply.findFirst({
    where: { id: payload.draftReplyId, orgId: job.orgId },
    include: { review: { include: { location: true } } },
  })
  if (!draft) return

  const review = draft.review
  if (review.googleReplyComment) {
    await prisma.draftReply.update({
      where: { id: draft.id },
      data: { status: "POSTED" },
    })
    return
  }

  if (draft.status !== "READY") {
    throw new NonRetryableError(
      "Draft is not READY. Verification must pass before posting."
    )
  }

  const trimmed = draft.text.trim()
  if (trimmed.length > MAX_GOOGLE_REPLY_CHARS) {
    throw new NonRetryableError("Reply too long for Google.")
  }

  const { accessToken } = await getAccessTokenForOrg(job.orgId)

  // Re-check on Google to avoid overwriting an existing reply.
  const remote = await getReview(accessToken, review.googleReviewName)
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

  const updated = await updateReviewReply(accessToken, review.googleReviewName, trimmed)

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
