import { prisma } from "@/lib/db"
import { ApiError } from "@/lib/api/errors"
import { decodeCursor, encodeCursor, parseDateOrThrow } from "@/lib/jobs/system-health.cursor"
import type { JobStatus, JobType, Prisma } from "@prisma/client"
import { JOB_LOCK_STALE_MS } from "@/lib/jobs/queue"
import { jobListFilterSchema, type JobListFilter, type JobOrder } from "@/lib/jobs/system-health.schemas"

type ListJobRow = {
  id: string
  type: JobType
  status: JobStatus
  attempts: number
  maxAttempts: number
  runAt: Date
  lockedAt: Date | null
  completedAt: Date | null
  createdAt: Date
  dedupKey: string | null
  lastErrorCode: string | null
  lastError: string | null
  triggeredByRequestId: string | null
  triggeredByUserId: string | null
}

function iso(d: Date | null | undefined) {
  return d ? d.toISOString() : null
}

function normalizeListFilter(filter: JobListFilter) {
  const parsed = jobListFilterSchema.safeParse(filter)
  if (!parsed.success) {
    throw new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid filter." })
  }
  const limit = parsed.data.limit ?? 50
  return { ...parsed.data, limit }
}

function listWhere(input: {
  orgId: string
  status?: JobStatus[]
  type?: JobType[]
  q?: string
  stale?: boolean
  now?: Date
}) {
  const where: Prisma.JobWhereInput = { orgId: input.orgId }
  if (input.status?.length) where.status = { in: input.status }
  if (input.type?.length) where.type = { in: input.type }
  if (input.q) {
    where.OR = [{ id: input.q }, { dedupKey: { contains: input.q } }]
  }

  if (input.stale) {
    const now = input.now ?? new Date()
    const staleBefore = new Date(now.getTime() - JOB_LOCK_STALE_MS)
    where.status = "RUNNING"
    where.lockedAt = { not: null, lte: staleBefore }
  }

  return where
}

function toListResponseRow(row: ListJobRow) {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    runAtIso: row.runAt.toISOString(),
    lockedAtIso: iso(row.lockedAt),
    completedAtIso: iso(row.completedAt),
    createdAtIso: row.createdAt.toISOString(),
    dedupKey: row.dedupKey,
    lastErrorCode: row.lastErrorCode,
    lastError: row.lastErrorCode ?? row.lastError,
    triggeredByUserId: row.triggeredByUserId,
    triggeredByRequestId: row.triggeredByRequestId,
  }
}

export async function listJobsForOrg(input: { orgId: string; filter: JobListFilter; now?: Date }) {
  const filter = normalizeListFilter(input.filter)
  const order: JobOrder = filter.order ?? "CREATED_AT_DESC"
  const cursor = filter.cursor ? decodeCursor(filter.cursor) : null

  if (cursor && cursor.order !== order) {
    throw new ApiError({ status: 400, code: "BAD_CURSOR", message: "Cursor does not match requested order." })
  }

  const whereBase = listWhere({
    orgId: input.orgId,
    status: filter.status as JobStatus[] | undefined,
    type: filter.type as JobType[] | undefined,
    q: filter.q,
    stale: filter.stale,
    now: input.now,
  })

  const baseSelect = {
    id: true,
    type: true,
    status: true,
    attempts: true,
    maxAttempts: true,
    runAt: true,
    lockedAt: true,
    completedAt: true,
    createdAt: true,
    dedupKey: true,
    lastErrorCode: true,
    lastError: true,
    triggeredByRequestId: true,
    triggeredByUserId: true,
  } satisfies Prisma.JobSelect

  if (order === "RUN_AT_ASC") {
    const c = cursor && cursor.order === "RUN_AT_ASC" ? cursor : null
    const where = c
      ? {
          AND: [
            whereBase,
            {
              OR: [
                { runAt: { gt: parseDateOrThrow(c.runAtIso, "cursor") } },
                { runAt: parseDateOrThrow(c.runAtIso, "cursor"), id: { gt: c.id } },
              ],
            },
          ],
        }
      : whereBase

    const rows = await prisma.job.findMany({
      where,
      orderBy: [{ runAt: "asc" }, { id: "asc" }],
      take: filter.limit + 1,
      select: baseSelect,
    })

    const hasMore = rows.length > filter.limit
    const page = rows.slice(0, filter.limit)
    const next = hasMore ? page[page.length - 1] : null
    return {
      jobs: page.map(toListResponseRow),
      nextCursor: next ? encodeCursor({ v: 1, order, runAtIso: next.runAt.toISOString(), id: next.id }) : null,
    }
  }

  if (order === "COMPLETED_AT_DESC") {
    const whereCompleted: Prisma.JobWhereInput = { ...whereBase, completedAt: { not: null } }
    const c = cursor && cursor.order === "COMPLETED_AT_DESC" ? cursor : null
    const where = c
      ? {
          AND: [
            whereCompleted,
            {
              OR: [
                { completedAt: { lt: parseDateOrThrow(c.completedAtIso, "cursor") } },
                { completedAt: parseDateOrThrow(c.completedAtIso, "cursor"), id: { lt: c.id } },
              ],
            },
          ],
        }
      : whereCompleted

    const rows = await prisma.job.findMany({
      where,
      orderBy: [{ completedAt: "desc" }, { id: "desc" }],
      take: filter.limit + 1,
      select: baseSelect,
    })

    const hasMore = rows.length > filter.limit
    const page = rows.slice(0, filter.limit)
    const next = hasMore ? page[page.length - 1] : null
    return {
      jobs: page.map(toListResponseRow),
      nextCursor:
        next && next.completedAt
          ? encodeCursor({ v: 1, order, completedAtIso: next.completedAt.toISOString(), id: next.id })
          : null,
    }
  }

  const c = cursor && cursor.order === "CREATED_AT_DESC" ? cursor : null
  const where = c
    ? {
        AND: [
          whereBase,
          {
            OR: [
              { createdAt: { lt: parseDateOrThrow(c.createdAtIso, "cursor") } },
              { createdAt: parseDateOrThrow(c.createdAtIso, "cursor"), id: { lt: c.id } },
            ],
          },
        ],
      }
    : whereBase

  const rows = await prisma.job.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: filter.limit + 1,
    select: baseSelect,
  })

  const hasMore = rows.length > filter.limit
  const page = rows.slice(0, filter.limit)
  const next = hasMore ? page[page.length - 1] : null
  return {
    jobs: page.map(toListResponseRow),
    nextCursor: next ? encodeCursor({ v: 1, order, createdAtIso: next.createdAt.toISOString(), id: next.id }) : null,
  }
}

export function isTerminalJobStatus(status: JobStatus) {
  return status === "COMPLETED" || status === "FAILED" || status === "CANCELLED"
}
