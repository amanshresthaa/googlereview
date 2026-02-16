import type { JobType, Prisma } from "@prisma/client"

export function jobSelect(includePayload: boolean) {
  const select = {
    id: true,
    orgId: true,
    type: true,
    status: true,
    payload: includePayload,
    attempts: true,
    maxAttempts: true,
    runAt: true,
    lockedAt: true,
    completedAt: true,
    createdAt: true,
    dedupKey: true,
    lastErrorCode: true,
    lastError: true,
    lastErrorMetaJson: true,
    triggeredByRequestId: true,
    triggeredByUserId: true,
  } satisfies Prisma.JobSelect
  return select
}

export function redactPayload(type: JobType, payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null
  const obj = payload as Record<string, unknown>

  if (type === "SYNC_LOCATIONS") return null
  if (type === "SYNC_REVIEWS") {
    const locationId = typeof obj.locationId === "string" ? obj.locationId : null
    return locationId ? { locationId } : null
  }
  if (type === "PROCESS_REVIEW") {
    const reviewId = typeof obj.reviewId === "string" ? obj.reviewId : null
    const mode = typeof obj.mode === "string" ? obj.mode : null
    const draftReplyId = typeof obj.draftReplyId === "string" ? obj.draftReplyId : null
    const out: Record<string, unknown> = {}
    if (reviewId) out.reviewId = reviewId
    if (mode) out.mode = mode
    if (draftReplyId) out.draftReplyId = draftReplyId
    return Object.keys(out).length ? out : null
  }
  if (type === "POST_REPLY") {
    const reviewId = typeof obj.reviewId === "string" ? obj.reviewId : null
    const draftReplyId = typeof obj.draftReplyId === "string" ? obj.draftReplyId : null
    const actorUserId = typeof obj.actorUserId === "string" ? obj.actorUserId : null
    const out: Record<string, unknown> = {}
    if (reviewId) out.reviewId = reviewId
    if (draftReplyId) out.draftReplyId = draftReplyId
    if (actorUserId) out.actorUserId = actorUserId
    return Object.keys(out).length ? out : null
  }
  return null
}
