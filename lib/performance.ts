import { prisma } from "@/lib/db"

export type PerformanceDailyPoint = {
  dayIso: string
  reviews: number
  replied: number
  avgRating: number | null
  flagged: number
}

export type PerformanceSummary = {
  range: {
    days: number
    startIso: string
    endIso: string
  }
  kpis: {
    avgRating: number
    totalReviews: number
    replyRate: number
    flaggedClaims: number
    aiBlockedRate: number
    avgSeoKeywordCoverage: number
    seoStuffingRiskCount: number
    requiredKeywordUsageRate: number
  }
  series: {
    daily: PerformanceDailyPoint[]
  }
  dspy: {
    activeProgramVersion: string | null
    programVersions: Array<{
      version: string
      draftArtifactVersion: string
      verifyArtifactVersion: string
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

function toDayIsoUtc(d: Date) {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function startOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0))
}

function endOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999))
}

export async function getPerformanceSummary(input: {
  orgId: string
  days: number
}): Promise<PerformanceSummary> {
  const days = Math.max(1, Math.min(365, Math.floor(input.days)))
  const now = new Date()
  const end = endOfUtcDay(now)
  const start = startOfUtcDay(new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - (days - 1))))

  const baseWhere = {
    orgId: input.orgId,
    createTime: { gte: start, lte: end },
    location: { enabled: true },
  } as const

  type AiQualityRow = {
    runs: number
    blocked: number
    stuffing_risk: number
    avg_keyword_coverage: number | null
    required_keyword_used: number
  }
  type ProgramVersionRow = {
    program_version: string
    draft_artifact_version: string
    verify_artifact_version: string
    runs: number
    blocked: number
    avg_keyword_coverage: number | null
    required_keyword_used: number
  }

  const [totalReviews, repliedReviews, avgAgg, flaggedClaims, aiQualityRows, aiProgramVersionRows, aiModeCounts] = await Promise.all([
    prisma.review.count({ where: baseWhere }),
    prisma.review.count({ where: { ...baseWhere, googleReplyComment: { not: null } } }),
    prisma.review.aggregate({ where: baseWhere, _avg: { starRating: true } }),
    prisma.review.count({
      where: {
        ...baseWhere,
        currentDraftReply: { is: { status: "BLOCKED_BY_VERIFIER" } },
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
      WHERE "orgId" = ${input.orgId}
        AND "createdAt" >= ${start}
        AND "createdAt" <= ${end}
        AND "status" = 'COMPLETED';
    `,
    prisma.$queryRaw<ProgramVersionRow[]>`
      SELECT
        COALESCE(NULLIF("programVersion", ''), 'unknown') AS "program_version",
        COALESCE(NULLIF("draftArtifactVersion", ''), 'unknown') AS "draft_artifact_version",
        COALESCE(NULLIF("verifyArtifactVersion", ''), 'unknown') AS "verify_artifact_version",
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
      WHERE "orgId" = ${input.orgId}
        AND "createdAt" >= ${start}
        AND "createdAt" <= ${end}
        AND "status" = 'COMPLETED'
      GROUP BY 1, 2, 3
      ORDER BY "runs" DESC, "program_version" ASC
      LIMIT 5;
    `,
    prisma.dspyRun.groupBy({
      by: ["mode"],
      where: { orgId: input.orgId, createdAt: { gte: start, lte: end }, status: "COMPLETED" },
      _count: { _all: true },
    }),
  ])

  const dailyRows = await prisma.$queryRaw<
    Array<{
      day: Date
      reviews: number
      replied: number
      avgRating: number | null
      flagged: number
    }>
  >`
    SELECT
      (date_trunc('day', r."createTime") AT TIME ZONE 'UTC') AS "day",
      COUNT(*)::int AS "reviews",
      SUM(CASE WHEN r."googleReplyComment" IS NOT NULL THEN 1 ELSE 0 END)::int AS "replied",
      AVG(r."starRating")::float AS "avgRating",
      SUM(CASE WHEN dr."status" = 'BLOCKED_BY_VERIFIER' THEN 1 ELSE 0 END)::int AS "flagged"
    FROM "Review" r
    JOIN "Location" l
      ON l."id" = r."locationId"
    LEFT JOIN "DraftReply" dr
      ON dr."id" = r."currentDraftReplyId"
    WHERE r."orgId" = ${input.orgId}
      AND l."enabled" = true
      AND r."createTime" >= ${start}
      AND r."createTime" <= ${end}
    GROUP BY "day"
    ORDER BY "day" ASC;
  `

  const byDay = new Map<string, PerformanceDailyPoint>()
  for (const row of dailyRows) {
    const dayIso = toDayIsoUtc(row.day)
    byDay.set(dayIso, {
      dayIso,
      reviews: row.reviews,
      replied: row.replied,
      avgRating: row.avgRating,
      flagged: row.flagged,
    })
  }

  const daily: PerformanceDailyPoint[] = []
  for (let i = 0; i < days; i++) {
    const day = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + i))
    const dayIso = toDayIsoUtc(day)
    daily.push(
      byDay.get(dayIso) ?? {
        dayIso,
        reviews: 0,
        replied: 0,
        avgRating: null,
        flagged: 0,
      }
    )
  }

  const avgRating = avgAgg._avg.starRating ?? 0
  const replyRate = totalReviews > 0 ? repliedReviews / totalReviews : 0
  const aiQuality = aiQualityRows[0] ?? {
    runs: 0,
    blocked: 0,
    stuffing_risk: 0,
    avg_keyword_coverage: null,
    required_keyword_used: 0,
  }
  const aiBlockedRate = aiQuality.runs > 0 ? aiQuality.blocked / aiQuality.runs : 0
  const requiredKeywordUsageRate = aiQuality.runs > 0 ? aiQuality.required_keyword_used / aiQuality.runs : 0
  const programVersions = aiProgramVersionRows.map((row) => {
    const runs = row.runs
    return {
      version: row.program_version,
      draftArtifactVersion: row.draft_artifact_version,
      verifyArtifactVersion: row.verify_artifact_version,
      runs,
      blockedRate: runs > 0 ? row.blocked / runs : 0,
      avgKeywordCoverage: row.avg_keyword_coverage ?? 0,
      requiredKeywordUsageRate: runs > 0 ? row.required_keyword_used / runs : 0,
    }
  })
  const modeDistribution = aiModeCounts.map((row) => ({
    mode: row.mode,
    runs: row._count._all,
    ratio: aiQuality.runs > 0 ? row._count._all / aiQuality.runs : 0,
  }))

  return {
    range: { days, startIso: start.toISOString(), endIso: end.toISOString() },
    kpis: {
      avgRating: Number(avgRating.toFixed(2)),
      totalReviews,
      replyRate: Number(replyRate.toFixed(4)),
      flaggedClaims,
      aiBlockedRate: Number(aiBlockedRate.toFixed(4)),
      avgSeoKeywordCoverage: Number((aiQuality.avg_keyword_coverage ?? 0).toFixed(4)),
      seoStuffingRiskCount: aiQuality.stuffing_risk,
      requiredKeywordUsageRate: Number(requiredKeywordUsageRate.toFixed(4)),
    },
    series: { daily },
    dspy: {
      activeProgramVersion: programVersions[0]?.version ?? null,
      programVersions,
      modeDistribution,
    },
  }
}
