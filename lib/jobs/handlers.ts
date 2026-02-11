import { prisma } from "@/lib/db"
import type { Job } from "@prisma/client"
import { z } from "zod"
import crypto from "node:crypto"
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
import { evidenceSnapshotSchema } from "@/lib/ai/draft"
import { DspyServiceError, type DspyProcessMode, processReviewWithDspy } from "@/lib/ai/dspy-client"
import { MAX_GOOGLE_REPLY_CHARS } from "@/lib/policy"
import { NonRetryableError } from "@/lib/jobs/errors"
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
    case "PROCESS_REVIEW":
      return handleProcessReview(job, signal)
    case "POST_REPLY":
      return handlePostReply(job)
    default:
      throw new Error(`Unhandled job type: ${job.type}`)
  }
}

const syncReviewsPayloadSchema = z.object({ locationId: z.string().min(1) }).passthrough()
const processReviewPayloadSchema = z
  .object({
    reviewId: z.string().min(1),
    mode: z.enum(["AUTO", "MANUAL_REGENERATE", "VERIFY_EXISTING_DRAFT"]),
    draftReplyId: z.string().min(1).optional(),
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
const MAX_AUTO_DRAFTS_PER_SYNC = 5

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
  const autoDraftCandidates: Array<{ reviewId: string; createTimeMs: number }> = []

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
        autoDraftCandidates.push({
          reviewId: upserted.id,
          createTimeMs: upserted.createTime.getTime(),
        })
      }
    }

    if (!nextPageToken) break
    pageToken = nextPageToken
  }

  for (const candidate of autoDraftCandidates
    .sort((a, b) => b.createTimeMs - a.createTimeMs)
    .slice(0, MAX_AUTO_DRAFTS_PER_SYNC)) {
    await enqueueJob({
      orgId: job.orgId,
      type: "PROCESS_REVIEW",
      payload: { reviewId: candidate.reviewId, mode: "AUTO" },
      dedupKey: `review:${candidate.reviewId}`,
    })
  }

  await prisma.location.update({
    where: { id: location.id },
    data: { lastReviewsSyncAt: new Date() },
  })
}

const UNKNOWN_MODEL = "unknown"
const UNKNOWN_PROGRAM_VERSION = "unknown"

async function handleProcessReview(job: Job, signal?: AbortSignal) {
  const payload = processReviewPayloadSchema.parse(job.payload)

  const review = await prisma.review.findFirst({
    where: { id: payload.reviewId, orgId: job.orgId },
    include: { location: true, currentDraftReply: { select: { id: true, text: true } } },
  })
  if (!review) return

  const isAuto = payload.mode === "AUTO"
  const isVerifyExisting = payload.mode === "VERIFY_EXISTING_DRAFT"
  let targetDraftId: string | null = null
  let candidateDraftText: string | undefined

  if (isAuto) {
    await enforceCooldownOrThrow({ orgId: job.orgId, scope: "GENERATE_DRAFT", key: review.id })
  }

  if (isVerifyExisting) {
    if (!payload.draftReplyId) {
      throw new NonRetryableError("BAD_REQUEST", "draftReplyId is required for verify mode.")
    }

    const draft = await prisma.draftReply.findFirst({
      where: {
        id: payload.draftReplyId,
        orgId: job.orgId,
        reviewId: review.id,
      },
      select: { id: true, text: true },
    })
    if (!draft) return

    if (review.currentDraftReplyId && review.currentDraftReplyId !== draft.id) {
      return
    }

    await enforceCooldownOrThrow({ orgId: job.orgId, scope: "VERIFY_DRAFT", key: draft.id })
    targetDraftId = draft.id
    candidateDraftText = draft.text
  }

  await consumeDailyBudgetOrThrow({
    orgId: job.orgId,
    scope: "AI",
    bypass: payload.budgetOverride?.enabled === true,
  })

  const settings = await prisma.orgSettings.findUnique({ where: { orgId: job.orgId } })
  const mentionKeywords = settings?.mentionKeywords ?? []
  const { mentions, highlights } = extractMentionsAndHighlights(review.comment, mentionKeywords)

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
    seoProfile: {
      primaryKeywords: review.location.seoPrimaryKeywords,
      secondaryKeywords: review.location.seoSecondaryKeywords,
      geoTerms: review.location.seoGeoTerms,
    },
    tone: {
      preset: settings?.tonePreset ?? "friendly",
      customInstructions: settings?.toneCustomInstructions ?? null,
    },
  }
  const evidenceValidated = evidenceSnapshotSchema.parse(evidence)

  const upstreamKey = "DSPY:process"
  await breakerPrecheckOrThrow({ orgId: job.orgId, upstreamKey })

  const currentDraftText = review.currentDraftReply?.text ?? undefined
  const inputHash = sha256Hash(
    JSON.stringify({
      reviewId: review.id,
      mode: payload.mode,
      currentDraftText: currentDraftText ?? null,
      candidateDraftText: candidateDraftText ?? null,
      evidence: evidenceValidated,
    }),
  )

  let result: Awaited<ReturnType<typeof processReviewWithDspy>>
  try {
    result = await processReviewWithDspy({
      orgId: job.orgId,
      reviewId: review.id,
      mode: payload.mode as DspyProcessMode,
      evidence: evidenceValidated,
      currentDraftText,
      candidateDraftText,
      requestId: job.triggeredByRequestId ?? undefined,
      signal,
    })
    await breakerRecordSuccess({ orgId: job.orgId, upstreamKey })
  } catch (error) {
    await breakerRecordFailure({ orgId: job.orgId, upstreamKey })
    await prisma.dspyRun.create({
      data: {
        orgId: job.orgId,
        reviewId: review.id,
        draftReplyId: targetDraftId ?? undefined,
        mode: payload.mode,
        status: "FAILED",
        programVersion: UNKNOWN_PROGRAM_VERSION,
        draftArtifactVersion: UNKNOWN_PROGRAM_VERSION,
        verifyArtifactVersion: UNKNOWN_PROGRAM_VERSION,
        draftModel: UNKNOWN_MODEL,
        verifyModel: UNKNOWN_MODEL,
        requestId: job.triggeredByRequestId ?? undefined,
        attemptCount: 0,
        inputHash,
        errorCode: errorCodeFromDspyError(error),
        errorMessage: errorMessageFromDspyError(error),
      },
    })
    throw error
  }

  const status = result.decision
  const verifierPayload = {
    dspy: {
      decision: status,
      verifier: result.verifier,
      seoQuality: result.seoQuality,
      generation: result.generation,
      models: result.models,
      trace: result.trace,
      latencyMs: result.latencyMs,
    },
  }

  if (isVerifyExisting) {
    if (!targetDraftId) return
    await prisma.$transaction(async (tx) => {
      await tx.draftReply.update({
        where: { id: targetDraftId },
        data: {
          status,
          verifierResultJson: verifierPayload as never,
        },
      })
      await tx.dspyRun.create({
        data: {
          orgId: job.orgId,
          reviewId: review.id,
          draftReplyId: targetDraftId,
          mode: payload.mode,
          status: "COMPLETED",
          decision: status,
          programVersion: result.program.version,
          draftArtifactVersion: result.program.draftArtifactVersion,
          verifyArtifactVersion: result.program.verifyArtifactVersion,
          draftModel: result.models.draft,
          verifyModel: result.models.verify,
          draftTraceId: result.trace.draftTraceId,
          verifyTraceId: result.trace.verifyTraceId,
          requestId: job.triggeredByRequestId ?? undefined,
          attemptCount: result.generation.attemptCount,
          latencyMs: result.latencyMs,
          inputHash,
          outputJson: result as never,
        },
      })
    })
    await setCooldownAfterSuccess({ orgId: job.orgId, scope: "VERIFY_DRAFT", key: targetDraftId })
    return
  }

  const maxVersion = await prisma.draftReply.aggregate({
    where: { reviewId: review.id },
    _max: { version: true },
  })
  const nextVersion = (maxVersion._max.version ?? 0) + 1
  const origin = payload.mode === "MANUAL_REGENERATE" ? "REGENERATED" : "AUTO"

  await prisma.$transaction(async (tx) => {
    const created = await tx.draftReply.create({
      data: {
        orgId: job.orgId,
        reviewId: review.id,
        version: nextVersion,
        text: result.draftText.trim(),
        origin,
        status,
        evidenceSnapshotJson: evidenceValidated as never,
        verifierResultJson: verifierPayload as never,
      },
    })

    await tx.review.update({
      where: { id: review.id },
      data: { currentDraftReplyId: created.id },
    })

    await tx.dspyRun.create({
      data: {
        orgId: job.orgId,
        reviewId: review.id,
        draftReplyId: created.id,
        mode: payload.mode,
        status: "COMPLETED",
        decision: status,
        programVersion: result.program.version,
        draftArtifactVersion: result.program.draftArtifactVersion,
        verifyArtifactVersion: result.program.verifyArtifactVersion,
        draftModel: result.models.draft,
        verifyModel: result.models.verify,
        draftTraceId: result.trace.draftTraceId,
        verifyTraceId: result.trace.verifyTraceId,
        requestId: job.triggeredByRequestId ?? undefined,
        attemptCount: result.generation.attemptCount,
        latencyMs: result.latencyMs,
        inputHash,
        outputJson: result as never,
      },
    })
  })

  if (isAuto) {
    await setCooldownAfterSuccess({ orgId: job.orgId, scope: "GENERATE_DRAFT", key: review.id })
  }
}

function errorCodeFromDspyError(error: unknown) {
  if (error instanceof DspyServiceError) return error.code
  return "INTERNAL_ERROR"
}

function errorMessageFromDspyError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error)
  return text.length <= 2000 ? text : text.slice(0, 2000)
}

function sha256Hash(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex")
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
