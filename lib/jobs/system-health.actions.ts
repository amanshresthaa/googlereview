import { prisma } from "@/lib/db"
import { ApiError } from "@/lib/api/errors"
import type { Prisma } from "@prisma/client"
import { jobActionSchema, bulkJobActionSchema, type JobAction, type BulkJobAction } from "@/lib/jobs/system-health.schemas"
import { JOB_LOCK_STALE_MS, maxAttemptsForJobType } from "@/lib/jobs/queue"
import { parseDateOrThrow } from "@/lib/jobs/system-health.cursor"
import { writeAuditLog } from "@/lib/jobs/system-health.audit"

function staleBefore(now: Date) {
  return new Date(now.getTime() - JOB_LOCK_STALE_MS)
}

export async function applyJobActionForOrg(input: {
  orgId: string
  jobId: string
  action: JobAction
  now?: Date
  requestId: string
  actorUserId: string
}) {
  const now = input.now ?? new Date()
  const actionParsed = jobActionSchema.safeParse(input.action)
  if (!actionParsed.success) {
    throw new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid action." })
  }

  const job = await prisma.job.findUnique({
    where: { id: input.jobId },
    select: {
      id: true,
      orgId: true,
      type: true,
      status: true,
      payload: true,
      dedupKey: true,
      lockedAt: true,
    },
  })
  if (!job || job.orgId !== input.orgId) {
    throw new ApiError({ status: 404, code: "NOT_FOUND", message: "Job not found." })
  }

  const action = actionParsed.data
  const staleCutoff = staleBefore(now)

  if (action.action === "RUN_NOW") {
    const updated = await prisma.job.updateMany({
      where: { id: job.id, orgId: input.orgId, status: { in: ["PENDING", "RETRYING"] }, lockedAt: null },
      data: { runAt: now },
    })
    if (updated.count !== 1) {
      throw new ApiError({ status: 409, code: "INVALID_STATE", message: "Job is not eligible for run-now." })
    }
    await writeAuditLog({
      orgId: input.orgId,
      actorUserId: input.actorUserId,
      action: "JOB_RUN_NOW",
      entityType: "Job",
      entityId: job.id,
      metadata: { previousStatus: job.status, requestId: input.requestId },
    })
    return { jobId: job.id, kind: "UPDATED" as const }
  }

  if (action.action === "RESCHEDULE") {
    const runAt = parseDateOrThrow(action.runAtIso, "runAtIso")
    const updated = await prisma.job.updateMany({
      where: { id: job.id, orgId: input.orgId, status: { in: ["PENDING", "RETRYING"] }, lockedAt: null },
      data: { runAt },
    })
    if (updated.count !== 1) {
      throw new ApiError({ status: 409, code: "INVALID_STATE", message: "Job is not eligible for reschedule." })
    }
    await writeAuditLog({
      orgId: input.orgId,
      actorUserId: input.actorUserId,
      action: "JOB_RESCHEDULE",
      entityType: "Job",
      entityId: job.id,
      metadata: { previousStatus: job.status, runAtIso: runAt.toISOString(), requestId: input.requestId },
    })
    return { jobId: job.id, kind: "UPDATED" as const }
  }

  if (action.action === "CANCEL") {
    const updated = await prisma.job.updateMany({
      where: {
        id: job.id,
        orgId: input.orgId,
        OR: [
          { status: { in: ["PENDING", "RETRYING"] }, lockedAt: null },
          { status: "RUNNING", lockedAt: { lte: staleCutoff } },
        ],
      },
      data: {
        status: "CANCELLED",
        completedAt: now,
        lockedAt: null,
        lockedBy: null,
        lastError: "CANCELLED_BY_USER",
        lastErrorCode: "CANCELLED_BY_USER",
        lastErrorMetaJson: { cancelledByUserId: input.actorUserId, requestId: input.requestId } as Prisma.InputJsonValue,
      },
    })
    if (updated.count !== 1) {
      throw new ApiError({ status: 409, code: "INVALID_STATE", message: "Job is not eligible for cancellation." })
    }
    await writeAuditLog({
      orgId: input.orgId,
      actorUserId: input.actorUserId,
      action: "JOB_CANCEL",
      entityType: "Job",
      entityId: job.id,
      metadata: { previousStatus: job.status, requestId: input.requestId },
    })
    return { jobId: job.id, kind: "UPDATED" as const }
  }

  if (action.action === "FORCE_UNLOCK") {
    const updated = await prisma.job.updateMany({
      where: { id: job.id, orgId: input.orgId, status: "RUNNING", lockedAt: { lte: staleCutoff } },
      data: { status: "RETRYING", lockedAt: null, lockedBy: null, runAt: now },
    })
    if (updated.count !== 1) {
      throw new ApiError({ status: 409, code: "INVALID_STATE", message: "Job is not eligible for force-unlock." })
    }
    await writeAuditLog({
      orgId: input.orgId,
      actorUserId: input.actorUserId,
      action: "JOB_FORCE_UNLOCK",
      entityType: "Job",
      entityId: job.id,
      metadata: { previousStatus: job.status, requestId: input.requestId },
    })
    return { jobId: job.id, kind: "UPDATED" as const }
  }

  if (action.action === "REQUEUE") {
    try {
      const created = await prisma.job.create({
        data: {
          orgId: input.orgId,
          type: job.type,
          payload: job.payload as never,
          dedupKey: job.dedupKey ?? undefined,
          triggeredByRequestId: input.requestId,
          triggeredByUserId: input.actorUserId,
          runAt: now,
          status: "PENDING",
          maxAttempts: maxAttemptsForJobType(job.type),
        },
        select: { id: true },
      })
      await writeAuditLog({
        orgId: input.orgId,
        actorUserId: input.actorUserId,
        action: "JOB_REQUEUE",
        entityType: "Job",
        entityId: job.id,
        metadata: { newJobId: created.id, requestId: input.requestId },
      })
      return { jobId: job.id, kind: "REQUEUED" as const, newJobId: created.id }
    } catch (err) {
      const e = err as { code?: string }
      if (e?.code === "P2002" && job.dedupKey) {
        const existing = await prisma.job.findFirst({
          where: {
            orgId: input.orgId,
            type: job.type,
            dedupKey: job.dedupKey,
            status: { in: ["PENDING", "RUNNING", "RETRYING"] },
          },
          select: { id: true },
        })
        throw new ApiError({
          status: 409,
          code: "DEDUP_INFLIGHT",
          message: "A job with this dedupKey is already in-flight.",
          details: { existingJobId: existing?.id ?? null },
        })
      }
      throw err
    }
  }

  throw new ApiError({ status: 400, code: "BAD_REQUEST", message: "Unknown action." })
}

export async function applyBulkJobActionForOrg(input: {
  orgId: string
  action: BulkJobAction
  now?: Date
  requestId: string
  actorUserId: string
}) {
  const parsed = bulkJobActionSchema.safeParse(input.action)
  if (!parsed.success) {
    throw new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid action." })
  }

  const now = input.now ?? new Date()
  const action = parsed.data

  if (action.action === "FORCE_UNLOCK_STALE") {
    const staleCutoff = staleBefore(now)
    const jobs = await prisma.job.findMany({
      where: { orgId: input.orgId, id: { in: action.jobIds } },
      select: { id: true, status: true, lockedAt: true },
    })

    const eligibleIds = jobs
      .filter((j) => j.status === "RUNNING" && j.lockedAt && j.lockedAt.getTime() <= staleCutoff.getTime())
      .map((j) => j.id)

    const updated = eligibleIds.length
      ? await prisma.job.updateMany({
          where: { orgId: input.orgId, id: { in: eligibleIds }, status: "RUNNING", lockedAt: { lte: staleCutoff } },
          data: { status: "RETRYING", lockedAt: null, lockedBy: null, runAt: now },
        })
      : { count: 0 }

    await writeAuditLog({
      orgId: input.orgId,
      actorUserId: input.actorUserId,
      action: "JOB_FORCE_UNLOCK_BULK",
      entityType: "JobBatch",
      entityId: input.requestId,
      metadata: {
        jobIds: action.jobIds,
        eligibleCount: eligibleIds.length,
        updatedCount: updated.count,
        requestId: input.requestId,
      },
    })

    return {
      kind: "BULK_UPDATED" as const,
      requested: action.jobIds.length,
      eligible: eligibleIds.length,
      updated: updated.count,
    }
  }

  if (action.action === "CANCEL_BACKLOG") {
    const staleCutoff = staleBefore(now)
    const limit = action.limit ?? 500
    const includeStaleRunning = action.includeStaleRunning ?? true

    const staleRunningClause: Prisma.JobWhereInput = { status: "RUNNING", lockedAt: { lte: staleCutoff } }

    const where: Prisma.JobWhereInput = {
      orgId: input.orgId,
      OR: [
        { status: { in: ["PENDING", "RETRYING"] }, lockedAt: null },
        ...(includeStaleRunning ? [staleRunningClause] : []),
      ],
    }

    // We select ids first so we can bound the update and return accurate counts.
    const candidates = await prisma.job.findMany({
      where,
      orderBy: [{ runAt: "asc" }, { id: "asc" }],
      take: limit,
      select: { id: true },
    })
    const ids = candidates.map((c) => c.id)

    const updated = ids.length
      ? await prisma.job.updateMany({
          where: {
            orgId: input.orgId,
            id: { in: ids },
            OR: [
              { status: { in: ["PENDING", "RETRYING"] }, lockedAt: null },
              ...(includeStaleRunning ? [staleRunningClause] : []),
            ],
          },
          data: {
            status: "CANCELLED",
            completedAt: now,
            lockedAt: null,
            lockedBy: null,
            lastError: "CANCELLED_BY_USER",
            lastErrorCode: "CANCELLED_BY_USER",
            lastErrorMetaJson: {
              cancelledByUserId: input.actorUserId,
              requestId: input.requestId,
              bulk: true,
            } as Prisma.InputJsonValue,
          },
        })
      : { count: 0 }

    await writeAuditLog({
      orgId: input.orgId,
      actorUserId: input.actorUserId,
      action: "JOB_CANCEL_BACKLOG",
      entityType: "JobBatch",
      entityId: input.requestId,
      metadata: {
        requestedLimit: limit,
        includeStaleRunning,
        selectedCount: ids.length,
        updatedCount: updated.count,
        requestId: input.requestId,
      },
    })

    return {
      kind: "BULK_UPDATED" as const,
      requested: limit,
      eligible: ids.length,
      updated: updated.count,
    }
  }

  throw new ApiError({ status: 400, code: "BAD_REQUEST", message: "Unsupported bulk action." })
}
