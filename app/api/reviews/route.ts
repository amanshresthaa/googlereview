import { NextResponse } from "next/server"
import { z } from "zod"
import { requireApiSession } from "@/lib/session"
import { prisma } from "@/lib/db"
import type { Prisma } from "@prisma/client"
import {
  buildReviewCountsWhere,
  buildReviewWhere,
  decodeReviewsCursor,
  encodeReviewsCursor,
  reviewsFilterSchema,
} from "@/lib/reviews/listing"

export const runtime = "nodejs"

const querySchema = z.object({
  filter: reviewsFilterSchema.optional(),
  mention: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
})

export async function GET(req: Request) {
  const session = await requireApiSession()
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })

  const url = new URL(req.url)
  const parsed = querySchema.safeParse({
    filter: url.searchParams.get("filter") ?? undefined,
    mention: url.searchParams.get("mention") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "BAD_REQUEST", details: parsed.error.flatten() }, { status: 400 })
  }

  const filter = parsed.data.filter ?? "unanswered"
  const mention = parsed.data.mention?.trim().toLowerCase()
  const take = parsed.data.limit ?? 50

  if (filter === "mentions" && !mention) {
    return NextResponse.json(
      { error: "BAD_REQUEST", details: { mention: ["Required for mentions filter"] } },
      { status: 400 }
    )
  }

  const where = buildReviewWhere({ orgId: session.orgId, filter, mention })

  const orderBy: Prisma.ReviewOrderByWithRelationInput[] = [{ createTime: "desc" }, { id: "desc" }]

  let cursorWhere: Prisma.ReviewWhereInput | undefined
  if (parsed.data.cursor) {
    let decoded
    try {
      decoded = decodeReviewsCursor(parsed.data.cursor)
    } catch {
      return NextResponse.json({ error: "BAD_CURSOR" }, { status: 400 })
    }
    const cursorTime = new Date(decoded.t)
    cursorWhere = {
      OR: [
        { createTime: { lt: cursorTime } },
        { createTime: cursorTime, id: { lt: decoded.id } },
      ],
    }
  }

  const [items, unansweredCount, urgentCount, fiveStarCount, mentionsTotalCount] = await Promise.all([
    prisma.review.findMany({
      where: cursorWhere ? { AND: [where, cursorWhere] } : where,
      include: { location: true, currentDraftReply: true },
      orderBy,
      take: take + 1,
    }),
    prisma.review.count({ where: buildReviewCountsWhere({ orgId: session.orgId, key: "unanswered" }) }),
    prisma.review.count({ where: buildReviewCountsWhere({ orgId: session.orgId, key: "urgent" }) }),
    prisma.review.count({ where: buildReviewCountsWhere({ orgId: session.orgId, key: "five_star" }) }),
    prisma.review.count({ where: buildReviewCountsWhere({ orgId: session.orgId, key: "mentions_total" }) }),
  ])

  const hasMore = items.length > take
  const page = items.slice(0, take)
  const last = page.at(-1)
  const nextCursor = hasMore && last ? encodeReviewsCursor({ t: last.createTime.toISOString(), id: last.id }) : null

  return NextResponse.json({
    rows: page.map((r) => ({
      id: r.id,
      starRating: r.starRating,
      snippet: (r.comment ?? "").slice(0, 120),
      createTimeIso: r.createTime.toISOString(),
      location: { id: r.location.id, displayName: r.location.displayName },
      unanswered: r.googleReplyComment == null,
      draftStatus: r.currentDraftReply?.status ?? null,
      mentions: r.mentions,
    })),
    nextCursor,
    counts: {
      unanswered: unansweredCount,
      urgent: urgentCount,
      five_star: fiveStarCount,
      mentions_total: mentionsTotalCount,
    },
  })
}
