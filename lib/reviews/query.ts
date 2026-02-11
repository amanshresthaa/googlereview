import { prisma } from "@/lib/db"
import type { Prisma } from "@prisma/client"
import {
  buildReviewWhere,
  decodeReviewsCursor,
  encodeReviewsCursor,
  type ReviewsFilter,
  type ReviewsStatus,
} from "@/lib/reviews/listing"
import type { ReviewListPage, ReviewListRow } from "@/lib/reviews/types"

type ReviewCountsRow = {
  unanswered: bigint | number | null
  urgent: bigint | number | null
  five_star: bigint | number | null
  mentions_total: bigint | number | null
}

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
}

function toInt(value: bigint | number | null | undefined) {
  if (typeof value === "bigint") return Number(value)
  return Number(value ?? 0)
}

function toReviewListRow(
  review: Prisma.ReviewGetPayload<{
    include: {
      location: true
      currentDraftReply: true
    }
  }>
): ReviewListRow {
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

export async function listReviewsPage(input: ListReviewsPageInput): Promise<ReviewListPage> {
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

  const includeCounts = !input.cursor

  const [items, countRows] = await Promise.all([
    prisma.review.findMany({
      where: cursorWhere ? { AND: [where, cursorWhere] } : where,
      include: { location: true, currentDraftReply: true },
      orderBy,
      take: input.limit + 1,
    }),
    includeCounts
      ? prisma.$queryRaw<ReviewCountsRow[]>`
          SELECT
            COALESCE(SUM(CASE WHEN r."googleReplyComment" IS NULL THEN 1 ELSE 0 END), 0)::bigint AS unanswered,
            COALESCE(SUM(CASE WHEN r."googleReplyComment" IS NULL AND r."starRating" <= 2 THEN 1 ELSE 0 END), 0)::bigint AS urgent,
            COALESCE(SUM(CASE WHEN r."starRating" = 5 THEN 1 ELSE 0 END), 0)::bigint AS five_star,
            COALESCE(SUM(CASE WHEN cardinality(r."mentions") > 0 THEN 1 ELSE 0 END), 0)::bigint AS mentions_total
          FROM "Review" r
          JOIN "Location" l
            ON l."id" = r."locationId"
          WHERE r."orgId" = ${input.orgId}
            AND l."enabled" = true
        `
      : Promise.resolve(null),
  ])

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
    const countsRow = countRows?.[0]
    response.counts = {
      unanswered: toInt(countsRow?.unanswered),
      urgent: toInt(countsRow?.urgent),
      five_star: toInt(countsRow?.five_star),
      mentions_total: toInt(countsRow?.mentions_total),
    }
  }

  return response
}
