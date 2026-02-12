import { prisma } from "@/lib/db"

import type { ReviewListCounts } from "@/lib/reviews/types"

import type { ReviewCountsQueryTiming } from "./types"

type ReviewCountsRow = {
  unanswered: bigint | number | null
  urgent: bigint | number | null
  five_star: bigint | number | null
  mentions_total: bigint | number | null
}

type ReviewCountsCacheEntry = {
  counts: ReviewListCounts
  expiresAt: number
}

const REVIEW_COUNTS_CACHE_TTL_MS = 15_000
const REVIEW_COUNTS_CACHE_MAX_ENTRIES = 512

const reviewCountsCache = new Map<string, ReviewCountsCacheEntry>()
const reviewCountsInflight = new Map<
  string,
  Promise<{ counts: ReviewListCounts; timing: ReviewCountsQueryTiming }>
>()

function toInt(value: bigint | number | null | undefined) {
  if (typeof value === "bigint") return Number(value)
  return Number(value ?? 0)
}

function getCachedReviewCounts(orgId: string): ReviewListCounts | null {
  const cached = reviewCountsCache.get(orgId)
  if (!cached) return null
  if (cached.expiresAt <= Date.now()) {
    reviewCountsCache.delete(orgId)
    return null
  }
  // Promote key to maintain simple LRU behavior.
  reviewCountsCache.delete(orgId)
  reviewCountsCache.set(orgId, cached)
  return cached.counts
}

function setCachedReviewCounts(orgId: string, counts: ReviewListCounts): void {
  reviewCountsCache.set(orgId, {
    counts,
    expiresAt: Date.now() + REVIEW_COUNTS_CACHE_TTL_MS,
  })
  if (reviewCountsCache.size <= REVIEW_COUNTS_CACHE_MAX_ENTRIES) return

  const oldest = reviewCountsCache.keys().next()
  if (!oldest.done) {
    reviewCountsCache.delete(oldest.value)
  }
}

export function invalidateReviewCountsCache(orgId?: string): void {
  if (orgId) {
    reviewCountsCache.delete(orgId)
    reviewCountsInflight.delete(orgId)
    return
  }

  reviewCountsCache.clear()
  reviewCountsInflight.clear()
}

export async function getReviewCountsForOrgWithTiming(
  orgId: string,
): Promise<{ counts: ReviewListCounts; timing: ReviewCountsQueryTiming }> {
  const cached = getCachedReviewCounts(orgId)
  if (cached) {
    return {
      counts: cached,
      timing: {
        countsMs: 0,
        cacheHit: true,
      },
    }
  }

  const inflight = reviewCountsInflight.get(orgId)
  if (inflight) {
    return inflight
  }

  const task = (async () => {
    const countsStartedAt = Date.now()
    const countRows = await prisma.$queryRaw<ReviewCountsRow[]>`
      SELECT
        COALESCE(SUM(CASE WHEN r."googleReplyComment" IS NULL THEN 1 ELSE 0 END), 0)::bigint AS unanswered,
        COALESCE(SUM(CASE WHEN r."googleReplyComment" IS NULL AND r."starRating" <= 2 THEN 1 ELSE 0 END), 0)::bigint AS urgent,
        COALESCE(SUM(CASE WHEN r."starRating" = 5 THEN 1 ELSE 0 END), 0)::bigint AS five_star,
        COALESCE(SUM(CASE WHEN cardinality(r."mentions") > 0 THEN 1 ELSE 0 END), 0)::bigint AS mentions_total
      FROM "Review" r
      JOIN "Location" l
        ON l."id" = r."locationId"
      WHERE r."orgId" = ${orgId}
        AND l."enabled" = true
    `

    const countsRow = countRows?.[0]
    const counts: ReviewListCounts = {
      unanswered: toInt(countsRow?.unanswered),
      urgent: toInt(countsRow?.urgent),
      five_star: toInt(countsRow?.five_star),
      mentions_total: toInt(countsRow?.mentions_total),
    }
    setCachedReviewCounts(orgId, counts)

    return {
      counts,
      timing: {
        countsMs: Date.now() - countsStartedAt,
        cacheHit: false,
      },
    }
  })().finally(() => {
    reviewCountsInflight.delete(orgId)
  })

  reviewCountsInflight.set(orgId, task)
  return task
}

export async function getReviewCountsForOrg(orgId: string): Promise<ReviewListCounts> {
  const { counts } = await getReviewCountsForOrgWithTiming(orgId)
  return counts
}
