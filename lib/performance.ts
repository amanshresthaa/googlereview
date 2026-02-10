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
  }
  series: {
    daily: PerformanceDailyPoint[]
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

  const [totalReviews, repliedReviews, avgAgg, flaggedClaims] = await Promise.all([
    prisma.review.count({ where: baseWhere }),
    prisma.review.count({ where: { ...baseWhere, googleReplyComment: { not: null } } }),
    prisma.review.aggregate({ where: baseWhere, _avg: { starRating: true } }),
    prisma.review.count({
      where: {
        ...baseWhere,
        currentDraftReply: { is: { status: "BLOCKED_BY_VERIFIER" } },
      },
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

  return {
    range: { days, startIso: start.toISOString(), endIso: end.toISOString() },
    kpis: {
      avgRating: Number(avgRating.toFixed(2)),
      totalReviews,
      replyRate: Number(replyRate.toFixed(4)),
      flaggedClaims,
    },
    series: { daily },
  }
}

