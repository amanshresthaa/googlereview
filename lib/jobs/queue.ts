import { prisma } from "@/lib/db"
import { computeBackoffMs } from "@/lib/jobs/backoff"
import { Prisma } from "@prisma/client"
import type { Job, JobStatus, JobType } from "@prisma/client"
import { NonRetryableError, RetryableJobError } from "@/lib/jobs/errors"
import { stableJsonStringify } from "@/lib/api/json"

function maxAttemptsForType(type: JobType) {
  if (type === "POST_REPLY") return 3
  if (type === "VERIFY_DRAFT") return 5
  if (type === "GENERATE_DRAFT") return 5
  if (type === "SYNC_LOCATIONS" || type === "SYNC_REVIEWS") return 8
  return 10
}

export async function enqueueJob(input: {
  orgId: string
  type: JobType
  payload: unknown
  runAt?: Date
  dedupKey?: string
  triggeredByRequestId?: string
  triggeredByUserId?: string
}) {
  try {
    return await prisma.job.create({
      data: {
        orgId: input.orgId,
        type: input.type,
        payload: input.payload as never,
        dedupKey: input.dedupKey,
        triggeredByRequestId: input.triggeredByRequestId,
        triggeredByUserId: input.triggeredByUserId,
        runAt: input.runAt ?? new Date(),
        status: "PENDING",
        maxAttempts: maxAttemptsForType(input.type),
      },
    })
  } catch (err) {
    // In-flight de-duplication (DB-enforced via partial unique index).
    // If a job already exists, return the existing job rather than failing.
    const e = err as { code?: string }
    if (input.dedupKey && e?.code === "P2002") {
      const existing = await prisma.job.findFirst({
        where: {
          orgId: input.orgId,
          type: input.type,
          dedupKey: input.dedupKey,
          status: { in: ["PENDING", "RUNNING", "RETRYING"] },
        },
      })
      if (existing) return existing
    }
    throw err
  }
}

export async function claimJobs(input: {
  limit: number
  workerId: string
  now?: Date
}) {
  const now = input.now ?? new Date()
  const staleBefore = new Date(now.getTime() - 15 * 60_000)

  return prisma.$transaction(async (tx) => {
    const jobs = await tx.$queryRaw<Job[]>`
      SELECT *
      FROM "Job"
      WHERE (
        ("status" IN ('PENDING','RETRYING') AND "runAt" <= ${now} AND "lockedAt" IS NULL)
        OR
        ("status" = 'RUNNING' AND "lockedAt" IS NOT NULL AND "lockedAt" <= ${staleBefore})
      )
      ORDER BY
        CASE "type"
          WHEN 'POST_REPLY' THEN 0
          WHEN 'VERIFY_DRAFT' THEN 1
          WHEN 'SYNC_REVIEWS' THEN 2
          WHEN 'SYNC_LOCATIONS' THEN 2
          WHEN 'GENERATE_DRAFT' THEN 3
          ELSE 9
        END ASC,
        "runAt" ASC
      LIMIT ${input.limit}
      FOR UPDATE SKIP LOCKED
    `

    if (jobs.length === 0) return []

    await tx.job.updateMany({
      where: { id: { in: jobs.map((j) => j.id) } },
      data: { status: "RUNNING", lockedAt: now, lockedBy: input.workerId },
    })

    return jobs
  })
}

export async function completeJob(id: string) {
  return prisma.job.update({
    where: { id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError: null,
      lastErrorCode: null,
      lastErrorMetaJson: Prisma.DbNull,
    },
  })
}

export async function markJobFailed(id: string, error: unknown) {
  const normalized = normalizeJobError(error)
  return prisma.job.update({
    where: { id },
    data: {
      status: "FAILED",
      completedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError: normalized.lastError,
      lastErrorCode: normalized.code,
      lastErrorMetaJson: normalized.meta ? (normalized.meta as Prisma.InputJsonValue) : Prisma.DbNull,
    },
  })
}

export async function retryJob(id: string, attempts: number, maxAttempts: number, error: unknown) {
  const nextMs = computeBackoffMs(attempts)
  const nextRunAt = new Date(Date.now() + nextMs)
  const normalized = normalizeJobError(error)

  const nextStatus: JobStatus = attempts + 1 >= maxAttempts ? "FAILED" : "RETRYING"
  return prisma.job.update({
    where: { id },
    data: {
      status: nextStatus,
      attempts: attempts + 1,
      runAt: nextRunAt,
      completedAt: nextStatus === "FAILED" ? new Date() : null,
      lockedAt: null,
      lockedBy: null,
      lastError: normalized.lastError,
      lastErrorCode: normalized.code,
      lastErrorMetaJson: normalized.meta ? (normalized.meta as Prisma.InputJsonValue) : Prisma.DbNull,
    },
  })
}

export function stringifyError(err: unknown) {
  // Back-compat: prefer a stable non-PII string.
  return normalizeJobError(err).lastError ?? "INTERNAL"
}

function normalizeJobError(err: unknown): { code: string; lastError: string | null; meta: Record<string, unknown> | null } {
  if (err instanceof NonRetryableError || err instanceof RetryableJobError) {
    return { code: err.code, lastError: safeErrorString(err.code, err.meta), meta: safeErrorMeta(err.meta) }
  }
  // Never persist raw upstream messages (may contain PII).
  return { code: "INTERNAL", lastError: "INTERNAL", meta: null }
}

function safeErrorString(code: string, meta?: Record<string, unknown>) {
  if (!meta) return code
  const text = stableJsonStringify({ code, meta })
  return text.length > 2000 ? text.slice(0, 2000) : text
}

function safeErrorMeta(meta?: Record<string, unknown>) {
  if (!meta) return null
  const text = stableJsonStringify(meta)
  if (text.length > 4000) return { truncated: true }
  return meta
}
