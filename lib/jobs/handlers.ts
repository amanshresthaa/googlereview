import { prisma } from "@/lib/db"
import { Prisma, type Job } from "@prisma/client"
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
import { invalidateReviewCountsCache } from "@/lib/reviews/query"
import { buildLocalReplyPolicyViolations, mergeVerifierViolations } from "@/lib/reviews/reply-guardrails"
<<<<<<< ours
<<<<<<< ours
import { buildVerifierResultEnvelope, type VerifierDecisionSource } from "@/lib/reviews/verifier-envelope"
=======
=======
>>>>>>> theirs
import {
  buildVerifierResultEnvelope,
  readVerifierFreshnessHash,
  type VerifierDecisionSource,
} from "@/lib/reviews/verifier-envelope"
import {
  buildVerifierEvidenceContext,
  computeVerifierFreshnessHash,
} from "@/lib/reviews/verifier-freshness"
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
import { enqueueJob } from "@/lib/jobs/queue"
import { DspyServiceError, type DspyProcessMode, processReviewWithDspy } from "@/lib/ai/dspy-client"
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
  let countsStateChanged = false

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
      select: {
        googleReviewName: true,
        starRating: true,
        googleReplyComment: true,
        mentions: true,
      },
    })
    const existingByName = new Map(existing.map((item) => [item.googleReviewName, item]))

    for (const r of reviews) {
      const star = starRatingToInt(r.starRating)
      const comment = r.comment ?? null
      const remoteReplyComment = r.reviewReply?.comment ?? null
      const { mentions } = extractMentionsAndHighlights(comment, mentionKeywords)
      const existingReview = existingByName.get(r.name)
      const isNew = !existingReview
      const mentionChanged = (existingReview?.mentions ?? []).join("|") !== mentions.join("|")
      const replyChanged = (existingReview?.googleReplyComment ?? null) !== remoteReplyComment
      const ratingChanged = existingReview?.starRating !== star
      if (isNew || mentionChanged || replyChanged || ratingChanged) {
        countsStateChanged = true
      }

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

  if (countsStateChanged) {
    invalidateReviewCountsCache(job.orgId)
  }
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
      throw new NonRetryableError("DRAFT_STALE", "Draft is stale.")
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
  const evidenceContext = buildVerifierEvidenceContext({
    review,
    location: review.location,
    settings: {
      mentionKeywords: settings?.mentionKeywords,
      tonePreset: settings?.tonePreset,
      toneCustomInstructions: settings?.toneCustomInstructions,
    },
  })
  const evidenceValidated = evidenceContext.evidence

  if (evidenceContext.mentions.join("|") !== review.mentions.join("|")) {
    await prisma.review.update({
      where: { id: review.id },
      data: { mentions: evidenceContext.mentions },
    })
  }

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
    throw normalizeDspyErrorToJobError(error)
  }

  const localPolicyViolations = buildLocalReplyPolicyViolations({ text: result.draftText })

  const combinedViolations = mergeVerifierViolations(result.verifier.violations, localPolicyViolations)
  const finalViolations = mergeVerifierViolations(
    combinedViolations,
    result.decision === "BLOCKED_BY_VERIFIER" && combinedViolations.length === 0
      ? [{ code: "VERIFIER_BLOCKED", message: "Draft was blocked by verifier. Please adjust and retry." }]
      : undefined,
  )

  const status: "READY" | "BLOCKED_BY_VERIFIER" =
    result.decision === "BLOCKED_BY_VERIFIER" || finalViolations.length > 0 ? "BLOCKED_BY_VERIFIER" : "READY"
  const dspyOutput = {
    ...result,
    appVerifier: {
      localViolations: localPolicyViolations,
      finalViolations,
      finalDecision: status,
    },
  }
  const verifierPayloadBody = {
    issues: finalViolations.map((violation) => violation.message),
    dspy: {
      decision: status,
      verifier: {
        pass: finalViolations.length === 0,
        violations: finalViolations,
        suggestedRewrite: result.verifier.suggestedRewrite ?? null,
      },
      seoQuality: result.seoQuality,
      generation: result.generation,
      models: result.models,
      trace: result.trace,
      latencyMs: result.latencyMs,
    },
    policy: {
      localViolations: localPolicyViolations,
    },
  }
  const decisionSource: VerifierDecisionSource =
    localPolicyViolations.length > 0 && result.decision !== "BLOCKED_BY_VERIFIER"
      ? "LOCAL_DETERMINISTIC_POLICY"
      : "DSPY_VERIFIER"
<<<<<<< ours
<<<<<<< ours
  const verifierPayload = buildVerifierResultEnvelope({
    decisionSource,
    payload: verifierPayloadBody,
  })
=======
  const normalizedDraftText = result.draftText.trim()
>>>>>>> theirs
=======
  const normalizedDraftText = result.draftText.trim()
>>>>>>> theirs

  if (isVerifyExisting) {
    if (!targetDraftId) return
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "Review" WHERE "id" = ${review.id} FOR UPDATE`

      const latestReview = await tx.review.findFirst({
        where: { id: review.id, orgId: job.orgId },
        select: { currentDraftReplyId: true },
      })
      if (!latestReview || latestReview.currentDraftReplyId !== targetDraftId) {
        throw new NonRetryableError("DRAFT_STALE", "Draft is stale.")
      }

      const latestDraft = await tx.draftReply.findFirst({
        where: { id: targetDraftId, orgId: job.orgId, reviewId: review.id },
        select: { text: true },
      })
      if (!latestDraft) {
        throw new NonRetryableError("DRAFT_STALE", "Draft is stale.")
      }

      const freshnessHash = computeVerifierFreshnessHash({
        evidence: evidenceValidated,
        draftText: latestDraft.text,
      })
      const verifierPayload = buildVerifierResultEnvelope({
        decisionSource,
        freshnessHash,
        payload: verifierPayloadBody,
      })

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
          outputJson: dspyOutput as never,
        },
      })
    })
    await setCooldownAfterSuccess({ orgId: job.orgId, scope: "VERIFY_DRAFT", key: targetDraftId })
    return
  }

  const origin = payload.mode === "MANUAL_REGENERATE" ? "REGENERATED" : "AUTO"

  await prisma.$transaction(async (tx) => {
    const nextVersion = await allocateNextDraftVersionTx(tx, review.id)
    const freshnessHash = computeVerifierFreshnessHash({
      evidence: evidenceValidated,
      draftText: normalizedDraftText,
    })
    const verifierPayload = buildVerifierResultEnvelope({
      decisionSource,
      freshnessHash,
      payload: verifierPayloadBody,
    })

    const created = await tx.draftReply.create({
      data: {
        orgId: job.orgId,
        reviewId: review.id,
        version: nextVersion,
        text: normalizedDraftText,
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
        outputJson: dspyOutput as never,
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

function normalizeDspyErrorToJobError(error: unknown) {
  // Ensure System Health shows stable, actionable error codes for DSPy failures.
  // Safety: do not persist raw upstream messages (only bounded meta via RetryableJobError/NonRetryableError).
  if (!(error instanceof DspyServiceError)) return error

  const meta = {
    dspyCode: error.code,
    httpStatus: error.status,
  }

  if (error.code === "INVALID_REQUEST") {
    return new NonRetryableError("DSPY_INVALID_REQUEST", "DSPy rejected the request.", meta)
  }

  if (error.code === "MODEL_SCHEMA_ERROR") {
    // Contract mismatch between app and DSPy service. Retrying won't fix this until a deploy.
    return new NonRetryableError("DSPY_SCHEMA_ERROR", "DSPy response schema error.", meta)
  }

  if (error.code === "MODEL_RATE_LIMIT") {
    return new RetryableJobError("DSPY_RATE_LIMIT", "DSPy rate limited.", meta)
  }

  if (error.code === "MODEL_TIMEOUT") {
    return new RetryableJobError("DSPY_MODEL_TIMEOUT", "DSPy timed out.", meta)
  }

  return new RetryableJobError("DSPY_INTERNAL", "DSPy internal error.", meta)
}

function sha256Hash(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex")
}

async function allocateNextDraftVersionTx(tx: Prisma.TransactionClient, reviewId: string) {
  const lockedReview = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "Review"
    WHERE "id" = ${reviewId}
    FOR UPDATE
  `
  if (lockedReview.length === 0) {
    throw new NonRetryableError("NOT_FOUND", "Review not found.")
  }

  const nextVersionRows = await tx.$queryRaw<Array<{ nextVersion: number }>>`
    SELECT COALESCE(MAX("version"), 0) + 1 AS "nextVersion"
    FROM "DraftReply"
    WHERE "reviewId" = ${reviewId}
  `
  const nextVersion = Number(nextVersionRows[0]?.nextVersion ?? 1)
  if (!Number.isInteger(nextVersion) || nextVersion < 1) {
    throw new NonRetryableError("INTERNAL", "Unable to allocate draft version.")
  }
  return nextVersion
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

<<<<<<< ours
<<<<<<< ours
=======
=======
>>>>>>> theirs
  const settings = await prisma.orgSettings.findUnique({
    where: { orgId: job.orgId },
    select: {
      mentionKeywords: true,
      tonePreset: true,
      toneCustomInstructions: true,
    },
  })
  const postEvidenceContext = buildVerifierEvidenceContext({
    review,
    location: review.location,
    settings: {
      mentionKeywords: settings?.mentionKeywords,
      tonePreset: settings?.tonePreset,
      toneCustomInstructions: settings?.toneCustomInstructions,
    },
  })
  const currentFreshnessHash = computeVerifierFreshnessHash({
    evidence: postEvidenceContext.evidence,
    draftText: trimmed,
  })
  const verifiedFreshnessHash = readVerifierFreshnessHash(draft.verifierResultJson)
  if (verifiedFreshnessHash !== currentFreshnessHash) {
    const staleMessage = "Draft verification is stale. Re-verify the draft before posting."
    const staleViolation = {
      code: "STALE_VERIFICATION",
      message: staleMessage,
    }
    const staleVerifierPayload = buildVerifierResultEnvelope({
      decisionSource: "LOCAL_DETERMINISTIC_POLICY",
      freshnessHash: currentFreshnessHash,
      payload: {
        issues: [staleMessage],
        policy: { localViolations: [staleViolation] },
      },
    })

    await prisma.draftReply.update({
      where: { id: draft.id },
      data: {
        status: "BLOCKED_BY_VERIFIER",
        verifierResultJson: staleVerifierPayload as never,
      },
    })
    throw new NonRetryableError("DRAFT_NOT_READY", staleMessage, {
      reason: "STALE_VERIFICATION",
      verifiedFreshnessHash: verifiedFreshnessHash ?? null,
      currentFreshnessHash,
    })
  }

<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
  const publishViolations = buildLocalReplyPolicyViolations({ text: trimmed })
  if (publishViolations.length > 0) {
    const verifierPayload = buildVerifierResultEnvelope({
      decisionSource: "LOCAL_DETERMINISTIC_POLICY",
<<<<<<< ours
<<<<<<< ours
=======
      freshnessHash: currentFreshnessHash,
>>>>>>> theirs
=======
      freshnessHash: currentFreshnessHash,
>>>>>>> theirs
      payload: {
        issues: publishViolations.map((violation) => violation.message),
        policy: { localViolations: publishViolations },
      },
    })

    await prisma.draftReply.update({
      where: { id: draft.id },
      data: {
        status: "BLOCKED_BY_VERIFIER",
        verifierResultJson: verifierPayload as never,
      },
    })
    throw new NonRetryableError("DRAFT_NOT_READY", publishViolations[0]!.message)
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
    invalidateReviewCountsCache(job.orgId)
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
  invalidateReviewCountsCache(job.orgId)
}
