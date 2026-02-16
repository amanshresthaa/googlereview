import { prisma } from "@/lib/db"
import type { JobType } from "@prisma/client"
import { handleAuthedGet } from "@/lib/api/handler"
import { ApiError } from "@/lib/api/errors"

export const runtime = "nodejs"

const JOB_TYPES: JobType[] = ["SYNC_LOCATIONS", "SYNC_REVIEWS", "PROCESS_REVIEW", "POST_REPLY"]

const SUMMARY_CACHE_TTL_MS = 10_000
const DETAIL_CACHE_TTL_MS = 30_000
const STALE_IF_ERROR_MAX_AGE_MS = 5 * 60_000
const ERROR_BACKOFF_MS = 15_000

type SummaryAggRow = {
  type: JobType
  pending: number
  running: number
  retrying: number
  failed_24h: number
}

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

type JobsSummaryBody = {
  summary: {
    byType: Record<JobType, SummaryRow>
    recentFailures: Array<{
      id: string
      type: JobType
      completedAtIso: string | null
      lastError: string | null
      lastErrorMeta?: Record<string, unknown> | null
    }>
    aiQuality24h?: {
      runs: number
      blocked: number
      stuffingRisk: number
      avgKeywordCoverage: number
      blockedRate: number
      stuffingRiskRate: number
      requiredKeywordUsageRate: number
      topProgramVersion: string | null
      programVersions: Array<{
        version: string
        runs: number
        blockedRate: number
        avgKeywordCoverage: number
        requiredKeywordUsageRate: number
      }>
      modeDistribution: Array<{
        mode: "AUTO" | "MANUAL_REGENERATE" | "VERIFY_EXISTING_DRAFT"
        runs: number
        ratio: number
      }>
    }
  }
}

type CacheEntry = {
  storedAt: number
  expiresAt: number
  body: JobsSummaryBody
}

const summaryCache = new Map<string, CacheEntry>()
const summaryInflight = new Map<string, Promise<JobsSummaryBody>>()
const summaryFailureAt = new Map<string, number>()

function getFreshSummary(cacheKey: string, now = Date.now()): JobsSummaryBody | null {
  const cached = summaryCache.get(cacheKey)
  if (!cached) return null
  if (cached.expiresAt <= now) return null
  return cached.body
}

function getStaleSummary(cacheKey: string, now = Date.now()): JobsSummaryBody | null {
  const cached = summaryCache.get(cacheKey)
  if (!cached) return null
  if (now - cached.storedAt > STALE_IF_ERROR_MAX_AGE_MS) return null
  return cached.body
}

function inFailureBackoff(cacheKey: string, now = Date.now()): boolean {
  const failedAt = summaryFailureAt.get(cacheKey)
  if (!failedAt) return false
  if (now - failedAt >= ERROR_BACKOFF_MS) return false
  return true
}

function cacheSummary(cacheKey: string, ttlMs: number, body: JobsSummaryBody, now = Date.now()) {
  summaryCache.set(cacheKey, {
    storedAt: now,
    expiresAt: now + ttlMs,
    body,
  })
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function isLikelyTransientDbFailure(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    if (
      message.includes("can't reach database") ||
      message.includes("timeout") ||
      message.includes("connection") ||
      message.includes("econnreset") ||
      message.includes("econnrefused") ||
      message.includes("etimedout")
    ) {
      return true
    }
  }

  if (error && typeof error === "object") {
    const code = (error as { code?: unknown }).code
    if (code === "P1001" || code === "ETIMEDOUT" || code === "ECONNREFUSED" || code === "ECONNRESET") {
      return true
    }
  }

  return false
}

function toSummaryApiError(error: unknown): ApiError {
  if (isLikelyTransientDbFailure(error)) {
    return new ApiError({
      status: 503,
      code: "INTERNAL",
      message: "Job summary is temporarily unavailable.",
    })
  }

  return new ApiError({
    status: 500,
    code: "INTERNAL",
    message: "Failed to load job summary.",
  })
}

export async function GET(req: Request) {
  return handleAuthedGet(req, async ({ session }) => {
    const url = new URL(req.url)
    const detail = url.searchParams.get("detail") === "1"
    const cacheKey = `${session.orgId}:${detail ? "detail" : "widget"}`
    const ttlMs = detail ? DETAIL_CACHE_TTL_MS : SUMMARY_CACHE_TTL_MS
    const now = Date.now()

    const cached = getFreshSummary(cacheKey, now)
    if (cached) {
      return { body: cached }
    }

    if (inFailureBackoff(cacheKey, now)) {
      const stale = getStaleSummary(cacheKey, now)
      if (stale) {
        return { body: stale, headers: { "X-Data-Stale": "1" } }
      }
    }

    const inflight = summaryInflight.get(cacheKey)
    if (inflight) {
      try {
        return { body: await inflight }
      } catch (error) {
        const stale = getStaleSummary(cacheKey)
        if (stale) {
          return { body: stale, headers: { "X-Data-Stale": "1" } }
        }
        throw toSummaryApiError(error)
      }
    }

    const compute = (async (): Promise<JobsSummaryBody> => {
      const now = new Date()
      const since = new Date(now.getTime() - 24 * 60 * 60_000)

      // Single bounded, index-backed aggregation query for widget summary.
      // Avoid Prisma groupBy overhead on large job tables.
      const rows = await prisma.$queryRaw<SummaryAggRow[]>`
        SELECT
          "type" AS "type",
          SUM(CASE WHEN "status" = 'PENDING' THEN 1 ELSE 0 END)::int AS "pending",
          SUM(CASE WHEN "status" = 'RUNNING' THEN 1 ELSE 0 END)::int AS "running",
          SUM(CASE WHEN "status" = 'RETRYING' THEN 1 ELSE 0 END)::int AS "retrying",
          SUM(CASE WHEN "status" = 'FAILED' AND "completedAt" >= ${since} THEN 1 ELSE 0 END)::int AS "failed_24h"
        FROM "Job"
        WHERE "orgId" = ${session.orgId}
          AND (
            "status" IN ('PENDING','RUNNING','RETRYING')
            OR ("status" = 'FAILED' AND "completedAt" >= ${since})
          )
        GROUP BY "type";
      `

      const byType: Record<JobType, SummaryRow> = Object.fromEntries(JOB_TYPES.map((t) => [t, emptyRow()])) as never

      for (const r of rows) {
        byType[r.type] = {
          pending: r.pending ?? 0,
          running: r.running ?? 0,
          retrying: r.retrying ?? 0,
          failed_24h: r.failed_24h ?? 0,
        }
      }

      if (!detail) {
        return { summary: { byType, recentFailures: [] } }
      }

      const [recentFailuresResult, aiQualityRowsResult, aiProgramVersionRowsResult, aiModeCountsResult] = await Promise.allSettled([
        prisma.job.findMany({
          where: { orgId: session.orgId, status: "FAILED", completedAt: { gte: since } },
          orderBy: { completedAt: "desc" },
          take: 20,
          select: {
            id: true,
            type: true,
            completedAt: true,
            lastError: true,
            lastErrorCode: true,
            lastErrorMetaJson: true,
          },
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

      if (recentFailuresResult.status === "rejected") {
        console.warn("[api/jobs/summary] detail recent failures query failed", {
          orgId: session.orgId,
          message: errorMessage(recentFailuresResult.reason),
        })
      }
      if (aiQualityRowsResult.status === "rejected") {
        console.warn("[api/jobs/summary] detail ai quality query failed", {
          orgId: session.orgId,
          message: errorMessage(aiQualityRowsResult.reason),
        })
      }
      if (aiProgramVersionRowsResult.status === "rejected") {
        console.warn("[api/jobs/summary] detail ai program versions query failed", {
          orgId: session.orgId,
          message: errorMessage(aiProgramVersionRowsResult.reason),
        })
      }
      if (aiModeCountsResult.status === "rejected") {
        console.warn("[api/jobs/summary] detail ai mode distribution query failed", {
          orgId: session.orgId,
          message: errorMessage(aiModeCountsResult.reason),
        })
      }

      const recentFailures =
        recentFailuresResult.status === "fulfilled" ? recentFailuresResult.value : []
      const aiQualityRows =
        aiQualityRowsResult.status === "fulfilled" ? aiQualityRowsResult.value : []
      const aiProgramVersionRows =
        aiProgramVersionRowsResult.status === "fulfilled" ? aiProgramVersionRowsResult.value : []
      const aiModeCounts =
        aiModeCountsResult.status === "fulfilled" ? aiModeCountsResult.value : []

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
      }
    })()

    summaryInflight.set(cacheKey, compute)
    try {
      const body = await compute
      cacheSummary(cacheKey, ttlMs, body)
      summaryFailureAt.delete(cacheKey)
      return { body }
    } catch (error) {
      summaryFailureAt.set(cacheKey, Date.now())
      console.warn("[api/jobs/summary] summary compute failed", {
        orgId: session.orgId,
        detail,
        message: errorMessage(error),
      })

      const stale = getStaleSummary(cacheKey)
      if (stale) {
        return { body: stale, headers: { "X-Data-Stale": "1" } }
      }

      throw toSummaryApiError(error)
    } finally {
      summaryInflight.delete(cacheKey)
    }
  })
}
