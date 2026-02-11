import { prisma } from "@/lib/db"
import { Prisma, type DraftStatus } from "@prisma/client"
import {
  buildReviewWhere,
  decodeReviewsCursor,
  encodeReviewsCursor,
  type ReviewsFilter,
  type ReviewsStatus,
} from "@/lib/reviews/listing"
import type { ReviewListCounts, ReviewListPage, ReviewListRow } from "@/lib/reviews/types"

type ReviewCountsRow = {
  unanswered: bigint | number | null
  urgent: bigint | number | null
  five_star: bigint | number | null
  mentions_total: bigint | number | null
}

const REVIEW_COUNTS_CACHE_TTL_MS = 15_000
const REVIEW_COUNTS_CACHE_MAX_ENTRIES = 512

type ReviewCountsCacheEntry = {
  counts: ReviewListCounts
  expiresAt: number
}

const reviewCountsCache = new Map<string, ReviewCountsCacheEntry>()
const reviewCountsInflight = new Map<string, Promise<{ counts: ReviewListCounts; timing: ReviewCountsQueryTiming }>>()

type ListReviewsPageInput = {
  orgId: string
  filter: ReviewsFilter
  mention?: string
  status?: ReviewsStatus
  locationId?: string
  rating?: number
  search?: string
  limit: number
  cursor?: string
  includeCounts?: boolean
}

export type ReviewListQueryTiming = {
  includeCounts: boolean
  listMs: number
  countsMs: number
  countsCacheHit: boolean
  totalMs: number
}

export type ReviewCountsQueryTiming = {
  countsMs: number
  cacheHit: boolean
}

const reviewListSelect = {
  id: true,
  starRating: true,
  comment: true,
  reviewerDisplayName: true,
  reviewerIsAnonymous: true,
  createTime: true,
  googleReplyComment: true,
  googleReplyUpdateTime: true,
  mentions: true,
  location: {
    select: {
      id: true,
      displayName: true,
    },
  },
  currentDraftReply: {
    select: {
      id: true,
      text: true,
      status: true,
      version: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.ReviewSelect

type ReviewListRecord = Prisma.ReviewGetPayload<{ select: typeof reviewListSelect }>

type FtsRawRow = {
  id: string
  starRating: number
  comment: string | null
  reviewerDisplayName: string | null
  reviewerIsAnonymous: boolean
  createTime: Date
  googleReplyComment: string | null
  googleReplyUpdateTime: Date | null
  mentions: string[]
  locationId: string
  locationDisplayName: string
  draftId: string | null
  draftText: string | null
  draftStatus: DraftStatus | null
  draftVersion: number | null
  draftUpdatedAt: Date | null
}

function mapFtsRowToRecord(row: FtsRawRow): ReviewListRecord {
  return {
    id: row.id,
    starRating: row.starRating,
    comment: row.comment,
    reviewerDisplayName: row.reviewerDisplayName,
    reviewerIsAnonymous: row.reviewerIsAnonymous,
    createTime: row.createTime,
    googleReplyComment: row.googleReplyComment,
    googleReplyUpdateTime: row.googleReplyUpdateTime,
    mentions: row.mentions,
    location: { id: row.locationId, displayName: row.locationDisplayName },
    currentDraftReply: row.draftId
      ? {
          id: row.draftId,
          text: row.draftText!,
          status: row.draftStatus!,
          version: row.draftVersion!,
          updatedAt: row.draftUpdatedAt!,
        }
      : null,
  }
}

async function listReviewsByFts(input: {
  orgId: string
  search: string
  filter: ReviewsFilter
  mention?: string
  status?: ReviewsStatus
  locationId?: string
  rating?: number
  cursor?: { t: string; id: string }
  limit: number
}): Promise<ReviewListRecord[]> {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`r."orgId" = ${input.orgId}`,
    Prisma.sql`r."search_vector" @@ plainto_tsquery('english', ${input.search})`,
  ]

  if (input.filter === "unanswered") {
    conditions.push(Prisma.sql`r."googleReplyComment" IS NULL`)
  }
  if (input.filter === "urgent") {
    conditions.push(Prisma.sql`r."googleReplyComment" IS NULL`)
    conditions.push(Prisma.sql`r."starRating" <= 2`)
  }
  if (input.filter === "five_star") {
    conditions.push(Prisma.sql`r."starRating" = 5`)
  }
  if (input.filter === "mentions") {
    const m = input.mention?.trim().toLowerCase()
    if (!m) {
      return []
    }
    conditions.push(Prisma.sql`${m} = ANY(r."mentions")`)
  }

  if (input.status === "pending") {
    conditions.push(Prisma.sql`r."googleReplyComment" IS NULL`)
  } else if (input.status === "replied") {
    conditions.push(Prisma.sql`r."googleReplyComment" IS NOT NULL`)
  }

  if (input.locationId) {
    conditions.push(Prisma.sql`r."locationId" = ${input.locationId}`)
  }

  if (typeof input.rating === "number") {
    conditions.push(Prisma.sql`r."starRating" = ${input.rating}`)
  }

  if (input.cursor) {
    const cursorTime = new Date(input.cursor.t)
    conditions.push(
      Prisma.sql`(r."createTime" < ${cursorTime} OR (r."createTime" = ${cursorTime} AND r."id" < ${input.cursor.id}))`,
    )
  }

  const whereClause = Prisma.join(conditions, " AND ")

  const rows = await prisma.$queryRaw<FtsRawRow[]>`
    SELECT
      r."id",
      r."starRating",
      r."comment",
      r."reviewerDisplayName",
      r."reviewerIsAnonymous",
      r."createTime",
      r."googleReplyComment",
      r."googleReplyUpdateTime",
      r."mentions",
      l."id" AS "locationId",
      l."displayName" AS "locationDisplayName",
      dr."id" AS "draftId",
      dr."text" AS "draftText",
      dr."status" AS "draftStatus",
      dr."version" AS "draftVersion",
      dr."updatedAt" AS "draftUpdatedAt"
    FROM "Review" r
    JOIN "Location" l ON l."id" = r."locationId" AND l."enabled" = true
    LEFT JOIN "DraftReply" dr ON dr."id" = r."currentDraftReplyId"
    WHERE ${whereClause}
    ORDER BY r."createTime" DESC, r."id" DESC
    LIMIT ${input.limit}
  `

  return rows.map(mapFtsRowToRecord)
}

function toInt(value: bigint | number | null | undefined) {
  if (typeof value === "bigint") return Number(value)
  return Number(value ?? 0)
}

function toReviewListRow(review: ReviewListRecord): ReviewListRow {
  return {
    id: review.id,
    starRating: review.starRating,
    snippet: (review.comment ?? "").slice(0, 120),
    comment: review.comment ?? "",
    reviewer: {
      displayName: review.reviewerDisplayName,
      isAnonymous: review.reviewerIsAnonymous,
    },
    createTimeIso: review.createTime.toISOString(),
    location: { id: review.location.id, displayName: review.location.displayName },
    unanswered: review.googleReplyComment == null,
    status: review.googleReplyComment == null ? "pending" : "replied",
    reply: {
      comment: review.googleReplyComment,
      updateTimeIso: review.googleReplyUpdateTime?.toISOString() ?? null,
    },
    currentDraft: review.currentDraftReply
      ? {
          id: review.currentDraftReply.id,
          text: review.currentDraftReply.text,
          status: review.currentDraftReply.status,
          version: review.currentDraftReply.version,
          updatedAtIso: review.currentDraftReply.updatedAt.toISOString(),
        }
      : null,
    draftStatus: review.currentDraftReply?.status ?? null,
    mentions: review.mentions,
  }
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

export async function listReviewsPageWithTiming(
  input: ListReviewsPageInput,
): Promise<{ page: ReviewListPage; timing: ReviewListQueryTiming }> {
  const startedAt = Date.now()
  const mention = input.mention?.trim().toLowerCase()
  if (input.filter === "mentions" && !mention) {
    throw new Error("MENTION_REQUIRED")
  }

  const where = buildReviewWhere({
    orgId: input.orgId,
    filter: input.filter,
    mention,
    status: input.status,
    locationId: input.locationId,
    rating: input.rating,
    search: input.search,
  })

  const orderBy: Prisma.ReviewOrderByWithRelationInput[] = [{ createTime: "desc" }, { id: "desc" }]

  let cursorWhere: Prisma.ReviewWhereInput | undefined
  if (input.cursor) {
    let decoded
    try {
      decoded = decodeReviewsCursor(input.cursor)
    } catch {
      throw new Error("BAD_CURSOR")
    }
    const cursorTime = new Date(decoded.t)
    cursorWhere = {
      OR: [
        { createTime: { lt: cursorTime } },
        { createTime: cursorTime, id: { lt: decoded.id } },
      ],
    }
  }

  const includeCounts = (input.includeCounts ?? true) && !input.cursor

  const searchTerm = input.search?.trim()

  const listPromise = (async () => {
    const listStartedAt = Date.now()
    let items: ReviewListRecord[]

    if (searchTerm) {
      let decodedCursor: { t: string; id: string } | undefined
      if (input.cursor) {
        try {
          decodedCursor = decodeReviewsCursor(input.cursor)
        } catch {
          throw new Error("BAD_CURSOR")
        }
      }

      items = await listReviewsByFts({
        orgId: input.orgId,
        search: searchTerm,
        filter: input.filter,
        mention,
        status: input.status,
        locationId: input.locationId,
        rating: input.rating,
        cursor: decodedCursor,
        limit: input.limit + 1,
      })
    } else {
      items = await prisma.review.findMany({
        where: cursorWhere ? { AND: [where, cursorWhere] } : where,
        select: reviewListSelect,
        orderBy,
        take: input.limit + 1,
      })
    }

    return { items, listMs: Date.now() - listStartedAt }
  })()

  const countsPromise: Promise<{ counts: ReviewListCounts | null; countsMs: number; countsCacheHit: boolean }> = includeCounts
    ? (async () => {
        const { counts, timing } = await getReviewCountsForOrgWithTiming(input.orgId)
        return { counts, countsMs: timing.countsMs, countsCacheHit: timing.cacheHit }
      })()
    : Promise.resolve({ counts: null, countsMs: 0, countsCacheHit: false })

  const [{ items, listMs }, { counts, countsMs, countsCacheHit }] = await Promise.all([listPromise, countsPromise])

  const hasMore = items.length > input.limit
  const page = items.slice(0, input.limit)
  const last = page.at(-1)
  const nextCursor =
    hasMore && last ? encodeReviewsCursor({ t: last.createTime.toISOString(), id: last.id }) : null

  const response: ReviewListPage = {
    rows: page.map(toReviewListRow),
    nextCursor,
  }

  if (includeCounts) {
    response.counts = counts ?? undefined
  }

  return {
    page: response,
    timing: {
      includeCounts,
      listMs,
      countsMs,
      countsCacheHit,
      totalMs: Date.now() - startedAt,
    },
  }
}

export async function listReviewsPage(input: ListReviewsPageInput): Promise<ReviewListPage> {
  const { page } = await listReviewsPageWithTiming(input)
  return page
}
