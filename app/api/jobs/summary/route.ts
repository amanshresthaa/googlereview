import { prisma } from "@/lib/db"
import type { JobStatus, JobType } from "@prisma/client"
import { handleAuthedGet } from "@/lib/api/handler"

export const runtime = "nodejs"

const JOB_TYPES: JobType[] = ["SYNC_LOCATIONS", "SYNC_REVIEWS", "GENERATE_DRAFT", "VERIFY_DRAFT", "POST_REPLY"]

type SummaryRow = {
  pending: number
  running: number
  retrying: number
  failed_24h: number
}

function emptyRow(): SummaryRow {
  return { pending: 0, running: 0, retrying: 0, failed_24h: 0 }
}

export async function GET(req: Request) {
  return handleAuthedGet(req, async ({ session }) => {
    const now = new Date()
    const since = new Date(now.getTime() - 24 * 60 * 60_000)

    const activeStatuses: JobStatus[] = ["PENDING", "RUNNING", "RETRYING"]

    const [activeGrouped, failedCounts, recentFailures] = await Promise.all([
      prisma.job.groupBy({
        by: ["type", "status"],
        where: { orgId: session.orgId, status: { in: activeStatuses } },
        _count: { _all: true },
      }),
      prisma.job.groupBy({
        by: ["type"],
        where: { orgId: session.orgId, status: "FAILED", completedAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.job.findMany({
        where: { orgId: session.orgId, status: "FAILED", completedAt: { gte: since } },
        orderBy: { completedAt: "desc" },
        take: 20,
        select: { id: true, type: true, completedAt: true, lastError: true, lastErrorCode: true, lastErrorMetaJson: true },
      }),
    ])

    const byType: Record<JobType, SummaryRow> = Object.fromEntries(JOB_TYPES.map((t) => [t, emptyRow()])) as never

    for (const g of activeGrouped) {
      const row = byType[g.type] ?? emptyRow()
      if (g.status === "PENDING") row.pending = g._count._all
      if (g.status === "RUNNING") row.running = g._count._all
      if (g.status === "RETRYING") row.retrying = g._count._all
      byType[g.type] = row
    }

    for (const f of failedCounts) {
      const row = byType[f.type] ?? emptyRow()
      row.failed_24h = f._count._all
      byType[f.type] = row
    }

    return {
      body: {
        summary: {
          byType,
          recentFailures: recentFailures.map((j) => ({
            id: j.id,
            type: j.type,
            completedAtIso: j.completedAt?.toISOString() ?? null,
            lastError: j.lastErrorCode ?? j.lastError ?? null,
            lastErrorMeta: (j.lastErrorMetaJson ?? null) as Record<string, unknown> | null,
          })),
        },
      },
    }
  })
}
