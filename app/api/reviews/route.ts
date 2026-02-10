import { z } from "zod"
import { prisma } from "@/lib/db"
import type { Prisma } from "@prisma/client"
import {
  buildReviewWhere,
  decodeReviewsCursor,
  encodeReviewsCursor,
  reviewsFilterSchema,
} from "@/lib/reviews/listing"
import { handleAuthedGet } from "@/lib/api/handler"
import { ApiError } from "@/lib/api/errors"
import { zodFields } from "@/lib/api/validation"

export const runtime = "nodejs"

type ReviewCountsRow = {
  unanswered: bigint | number | null
  urgent: bigint | number | null
  five_star: bigint | number | null
  mentions_total: bigint | number | null
}

function toInt(value: bigint | number | null | undefined) {
  if (typeof value === "bigint") return Number(value)
  return Number(value ?? 0)
}

const querySchema = z.object({
  filter: reviewsFilterSchema.optional(),
  mention: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
})

export async function GET(req: Request) {
  return handleAuthedGet(req, async ({ session, url }) => {
    const parsed = querySchema.safeParse({
      filter: url.searchParams.get("filter") ?? undefined,
      mention: url.searchParams.get("mention") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
    })
    if (!parsed.success) {
      const { details, fields } = zodFields(parsed.error)
      throw new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid query.", details, fields })
    }

    const filter = parsed.data.filter ?? "unanswered"
    const mention = parsed.data.mention?.trim().toLowerCase()
    const take = parsed.data.limit ?? 50

    if (filter === "mentions" && !mention) {
      throw new ApiError({
        status: 400,
        code: "BAD_REQUEST",
        message: "mention is required when filter=mentions.",
        fields: { mention: ["Required for mentions filter"] },
      })
    }

    const where = buildReviewWhere({ orgId: session.orgId, filter, mention })

    const orderBy: Prisma.ReviewOrderByWithRelationInput[] = [{ createTime: "desc" }, { id: "desc" }]

    let cursorWhere: Prisma.ReviewWhereInput | undefined
    if (parsed.data.cursor) {
      let decoded
      try {
        decoded = decodeReviewsCursor(parsed.data.cursor)
      } catch {
        throw new ApiError({ status: 400, code: "BAD_CURSOR", message: "Invalid cursor." })
      }
      const cursorTime = new Date(decoded.t)
      cursorWhere = {
        OR: [
          { createTime: { lt: cursorTime } },
          { createTime: cursorTime, id: { lt: decoded.id } },
        ],
      }
    }

    const includeCounts = !parsed.data.cursor

    const [items, countRows] = await Promise.all([
      prisma.review.findMany({
        where: cursorWhere ? { AND: [where, cursorWhere] } : where,
        include: { location: true, currentDraftReply: true },
        orderBy,
        take: take + 1,
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
            WHERE r."orgId" = ${session.orgId}
              AND l."enabled" = true
          `
        : Promise.resolve(null),
    ])

    const hasMore = items.length > take
    const page = items.slice(0, take)
    const last = page.at(-1)
    const nextCursor =
      hasMore && last ? encodeReviewsCursor({ t: last.createTime.toISOString(), id: last.id }) : null

    const countsRow = includeCounts ? countRows?.[0] : null

    return {
      body: {
        rows: page.map((r) => ({
          id: r.id,
          starRating: r.starRating,
          snippet: (r.comment ?? "").slice(0, 120),
          comment: r.comment ?? "",
          reviewer: {
            displayName: r.reviewerDisplayName,
            isAnonymous: r.reviewerIsAnonymous,
          },
          createTimeIso: r.createTime.toISOString(),
          location: { id: r.location.id, displayName: r.location.displayName },
          unanswered: r.googleReplyComment == null,
          status: r.googleReplyComment == null ? "pending" : "replied",
          reply: {
            comment: r.googleReplyComment,
            updateTimeIso: r.googleReplyUpdateTime?.toISOString() ?? null,
          },
          currentDraft: r.currentDraftReply
            ? {
                id: r.currentDraftReply.id,
                text: r.currentDraftReply.text,
                status: r.currentDraftReply.status,
                version: r.currentDraftReply.version,
                updatedAtIso: r.currentDraftReply.updatedAt.toISOString(),
              }
            : null,
          draftStatus: r.currentDraftReply?.status ?? null,
          mentions: r.mentions,
        })),
        nextCursor,
        ...(includeCounts
          ? {
              counts: {
                unanswered: toInt(countsRow?.unanswered),
                urgent: toInt(countsRow?.urgent),
                five_star: toInt(countsRow?.five_star),
                mentions_total: toInt(countsRow?.mentions_total),
              },
            }
          : {}),
      },
    }
  })
}
