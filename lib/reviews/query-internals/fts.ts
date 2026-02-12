import { prisma } from "@/lib/db"
import { Prisma, type DraftStatus } from "@prisma/client"

import type { ReviewsFilter, ReviewsStatus } from "@/lib/reviews/listing"

import type { ReviewListRecord } from "./records"
import type { ReviewsCursor } from "./types"

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

export async function listReviewsBySql(input: {
  orgId: string
  search?: string
  filter: ReviewsFilter
  mention?: string
  status?: ReviewsStatus
  locationId?: string
  rating?: number
  cursor?: ReviewsCursor
  limit: number
}): Promise<ReviewListRecord[]> {
  const conditions: Prisma.Sql[] = [Prisma.sql`r."orgId" = ${input.orgId}`]

  const search = input.search?.trim()
  if (search) {
    const likeQuery = `%${search}%`
    conditions.push(
      Prisma.sql`(r."search_vector" @@ plainto_tsquery('english', ${search}) OR l."displayName" ILIKE ${likeQuery})`,
    )
  }

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
    const mention = input.mention?.trim().toLowerCase()
    if (!mention) {
      return []
    }
    conditions.push(Prisma.sql`${mention} = ANY(r."mentions")`)
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
