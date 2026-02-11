import { prisma } from "@/lib/db"
import type { JobStatus, JobType } from "@prisma/client"
import { handleAuthedGet } from "@/lib/api/handler"

export const runtime = "nodejs"

const JOB_TYPES: JobType[] = ["SYNC_LOCATIONS", "SYNC_REVIEWS", "PROCESS_REVIEW", "POST_REPLY"]

type SummaryRow = {
  pending: number
  running: number
  retrying: number
  failed_24h: number
}

type AiQualityRow = {
  runs: number
  blocked: number
  stuffing_risk: number
  avg_keyword_coverage: number | null
  required_keyword_used: number
}

type ProgramVersionRow = {
  program_version: string
  runs: number
  blocked: number
  avg_keyword_coverage: number | null
  required_keyword_used: number
}

function emptyRow(): SummaryRow {
  return { pending: 0, running: 0, retrying: 0, failed_24h: 0 }
}

export async function GET(req: Request) {
  return handleAuthedGet(req, async ({ session }) => {
    const now = new Date()
    const since = new Date(now.getTime() - 24 * 60 * 60_000)

    const activeStatuses: JobStatus[] = ["PENDING", "RUNNING", "RETRYING"]

    const [activeGrouped, failedCounts, recentFailures, aiQualityRows, aiProgramVersionRows, aiModeCounts] = await Promise.all([
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
      prisma.$queryRaw<AiQualityRow[]>`
        SELECT
          COUNT(*)::int AS "runs",
          SUM(CASE WHEN "decision" = 'BLOCKED_BY_VERIFIER' THEN 1 ELSE 0 END)::int AS "blocked",
          SUM(
            CASE
              WHEN COALESCE((NULLIF("outputJson"->'seoQuality'->>'stuffingRisk', ''))::boolean, false) THEN 1
              ELSE 0
            END
          )::int AS "stuffing_risk",
          AVG((NULLIF("outputJson"->'seoQuality'->>'keywordCoverage', ''))::double precision) AS "avg_keyword_coverage",
          SUM(
            CASE
              WHEN COALESCE((NULLIF("outputJson"->'seoQuality'->>'requiredKeywordUsed', ''))::boolean, false) THEN 1
              ELSE 0
            END
          )::int AS "required_keyword_used"
        FROM "DspyRun"
        WHERE "orgId" = ${session.orgId}
          AND "createdAt" >= ${since}
          AND "status" = 'COMPLETED';
      `,
      prisma.$queryRaw<ProgramVersionRow[]>`
        SELECT
          COALESCE(NULLIF("programVersion", ''), 'unknown') AS "program_version",
          COUNT(*)::int AS "runs",
          SUM(CASE WHEN "decision" = 'BLOCKED_BY_VERIFIER' THEN 1 ELSE 0 END)::int AS "blocked",
          AVG((NULLIF("outputJson"->'seoQuality'->>'keywordCoverage', ''))::double precision) AS "avg_keyword_coverage",
          SUM(
            CASE
              WHEN COALESCE((NULLIF("outputJson"->'seoQuality'->>'requiredKeywordUsed', ''))::boolean, false) THEN 1
              ELSE 0
            END
          )::int AS "required_keyword_used"
        FROM "DspyRun"
        WHERE "orgId" = ${session.orgId}
          AND "createdAt" >= ${since}
          AND "status" = 'COMPLETED'
        GROUP BY 1
        ORDER BY "runs" DESC, "program_version" ASC
        LIMIT 5;
      `,
      prisma.dspyRun.groupBy({
        by: ["mode"],
        where: { orgId: session.orgId, createdAt: { gte: since }, status: "COMPLETED" },
        _count: { _all: true },
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

    const aiQuality = aiQualityRows[0] ?? {
      runs: 0,
      blocked: 0,
      stuffing_risk: 0,
      avg_keyword_coverage: null,
      required_keyword_used: 0,
    }
    const aiRuns = aiQuality.runs
    const blockedRate = aiRuns > 0 ? aiQuality.blocked / aiRuns : 0
    const stuffingRiskRate = aiRuns > 0 ? aiQuality.stuffing_risk / aiRuns : 0
    const requiredKeywordUsageRate = aiRuns > 0 ? aiQuality.required_keyword_used / aiRuns : 0
    const programVersions = aiProgramVersionRows.map((row) => {
      const runs = row.runs
      return {
        version: row.program_version,
        runs,
        blockedRate: runs > 0 ? row.blocked / runs : 0,
        avgKeywordCoverage: row.avg_keyword_coverage ?? 0,
        requiredKeywordUsageRate: runs > 0 ? row.required_keyword_used / runs : 0,
      }
    })
    const modeDistribution = aiModeCounts.map((row) => ({
      mode: row.mode,
      runs: row._count._all,
      ratio: aiRuns > 0 ? row._count._all / aiRuns : 0,
    }))

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
          aiQuality24h: {
            runs: aiRuns,
            blocked: aiQuality.blocked,
            stuffingRisk: aiQuality.stuffing_risk,
            avgKeywordCoverage: aiQuality.avg_keyword_coverage ?? 0,
            blockedRate,
            stuffingRiskRate,
            requiredKeywordUsageRate,
            topProgramVersion: programVersions[0]?.version ?? null,
            programVersions,
            modeDistribution,
          },
        },
      },
    }
  })
}
