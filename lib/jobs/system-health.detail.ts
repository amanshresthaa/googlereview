import { prisma } from "@/lib/db"
import { ApiError } from "@/lib/api/errors"
import { iso } from "@/lib/jobs/system-health.cursor"
import { jobSelect, redactPayload } from "@/lib/jobs/system-health.redaction"

type DspyLatest = {
  id: string
  createdAtIso: string
  status: "COMPLETED" | "FAILED"
  mode: "AUTO" | "MANUAL_REGENERATE" | "VERIFY_EXISTING_DRAFT"
  decision: string | null
  errorCode: string | null
  errorMessage: string | null
  programVersion: string | null
  experimentId: string | null
  draftModel: string | null
  verifyModel: string | null
  draftTraceId: string | null
  verifyTraceId: string | null
  latencyMs: number | null
}

function extractReviewIdFromPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") return null
  const obj = payload as Record<string, unknown>
  return typeof obj.reviewId === "string" ? obj.reviewId : null
}

function truncateText(text: string | null, max: number) {
  if (!text) return text
  if (text.length <= max) return text
  return `${text.slice(0, Math.max(0, max - 1))}…`
}

export async function getJobDetailForOrg(input: {
  orgId: string
  jobId: string
  includePayload: boolean
  includeDspyLatest?: boolean
}) {
  const job = await prisma.job.findUnique({
    where: { id: input.jobId },
    select: jobSelect(input.includePayload),
  })
  if (!job || job.orgId !== input.orgId) {
    throw new ApiError({ status: 404, code: "NOT_FOUND", message: "Job not found." })
  }

  const lastErrorMeta = (job.lastErrorMetaJson ?? null) as Record<string, unknown> | null
  const payload = input.includePayload ? redactPayload(job.type, job.payload) : null

  let dspyLatest: DspyLatest | null = null
  if (input.includeDspyLatest && job.type === "PROCESS_REVIEW") {
    const reviewId = extractReviewIdFromPayload(job.payload)
    if (reviewId) {
      const latest = await prisma.dspyRun.findFirst({
        where: { orgId: input.orgId, reviewId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          status: true,
          mode: true,
          decision: true,
          errorCode: true,
          errorMessage: true,
          programVersion: true,
          experimentId: true,
          draftModel: true,
          verifyModel: true,
          draftTraceId: true,
          verifyTraceId: true,
          latencyMs: true,
        },
      })
      if (latest) {
        dspyLatest = {
          id: latest.id,
          createdAtIso: latest.createdAt.toISOString(),
          status: latest.status,
          mode: latest.mode,
          decision: latest.decision ?? null,
          errorCode: latest.errorCode ?? null,
          errorMessage: truncateText(latest.errorMessage ?? null, 600),
          programVersion: latest.programVersion ?? null,
          experimentId: latest.experimentId ?? null,
          draftModel: latest.draftModel ?? null,
          verifyModel: latest.verifyModel ?? null,
          draftTraceId: latest.draftTraceId ?? null,
          verifyTraceId: latest.verifyTraceId ?? null,
          latencyMs: latest.latencyMs ?? null,
        }
      }
    }
  }
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    runAtIso: job.runAt.toISOString(),
    lockedAtIso: iso(job.lockedAt),
    completedAtIso: iso(job.completedAt),
    createdAtIso: job.createdAt.toISOString(),
    dedupKey: job.dedupKey ?? null,
    lastError: job.lastErrorCode ?? job.lastError ?? null,
    lastErrorCode: job.lastErrorCode ?? null,
    lastErrorMeta,
    payload,
    dspyLatest,
    triggeredByUserId: job.triggeredByUserId ?? null,
    triggeredByRequestId: job.triggeredByRequestId ?? null,
  }
}
