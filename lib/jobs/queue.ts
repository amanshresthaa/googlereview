import { prisma } from "@/lib/db"
import { computeBackoffMs } from "@/lib/jobs/backoff"
import type { Job, JobStatus, JobType } from "@prisma/client"

export async function enqueueJob(input: {
  orgId: string
  type: JobType
  payload: unknown
  runAt?: Date
}) {
  return prisma.job.create({
    data: {
      orgId: input.orgId,
      type: input.type,
      payload: input.payload as never,
      runAt: input.runAt ?? new Date(),
      status: "PENDING",
    },
  })
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
    },
  })
}

export async function markJobFailed(id: string, error: unknown) {
  return prisma.job.update({
    where: { id },
    data: {
      status: "FAILED",
      completedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError: stringifyError(error),
    },
  })
}

export async function retryJob(id: string, attempts: number, maxAttempts: number, error: unknown) {
  const nextMs = computeBackoffMs(attempts)
  const nextRunAt = new Date(Date.now() + nextMs)

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
      lastError: stringifyError(error),
    },
  })
}

export function stringifyError(err: unknown) {
  if (err instanceof Error) {
    const msg = `${err.name}: ${err.message}`
    return msg.length > 2000 ? msg.slice(0, 2000) : msg
  }
  const msg = String(err)
  return msg.length > 2000 ? msg.slice(0, 2000) : msg
}
