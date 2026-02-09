import { NextResponse } from "next/server"
import { z } from "zod"
import { requireApiSession } from "@/lib/session"
import { prisma } from "@/lib/db"
import type { Prisma } from "@prisma/client"

export const runtime = "nodejs"

const querySchema = z.object({
  filter: z.string().optional(),
  mention: z.string().optional(),
  cursor: z.string().optional(),
})

export async function GET(req: Request) {
  const session = await requireApiSession()
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })

  const url = new URL(req.url)
  const parsed = querySchema.safeParse({
    filter: url.searchParams.get("filter") ?? undefined,
    mention: url.searchParams.get("mention") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "BAD_REQUEST", details: parsed.error.flatten() }, { status: 400 })
  }

  const filter = parsed.data.filter ?? "unanswered"
  const mention = parsed.data.mention?.trim().toLowerCase()
  const take = 25

  const where: Prisma.ReviewWhereInput = { orgId: session.orgId }

  if (filter === "unanswered") {
    where.googleReplyComment = null
  } else if (filter === "urgent") {
    where.googleReplyComment = null
    where.starRating = { lte: 2 }
  } else if (filter === "five_star") {
    where.starRating = 5
  } else if (filter === "all") {
    // no-op
  } else if (filter === "mentions") {
    if (!mention) {
      return NextResponse.json({ error: "BAD_REQUEST", details: { mention: ["Required for mentions filter"] } }, { status: 400 })
    }
    where.mentions = { has: mention }
  }

  const orderBy: Prisma.ReviewOrderByWithRelationInput[] = [{ createTime: "desc" }, { id: "desc" }]

  const cursor = parsed.data.cursor
  const items = await prisma.review.findMany({
    where,
    include: { location: true, currentDraftReply: true },
    orderBy,
    take: take + 1,
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1,
        }
      : {}),
  })

  const hasMore = items.length > take
  const page = items.slice(0, take)
  const nextCursor = hasMore ? page[page.length - 1]!.id : null

  return NextResponse.json({
    items: page.map((r) => ({
      id: r.id,
      starRating: r.starRating,
      comment: r.comment,
      snippet: (r.comment ?? "").slice(0, 160),
      createTime: r.createTime.toISOString(),
      location: { id: r.location.id, name: r.location.displayName },
      unanswered: !r.googleReplyComment,
      currentDraft: r.currentDraftReply
        ? { id: r.currentDraftReply.id, status: r.currentDraftReply.status }
        : null,
      mentions: r.mentions,
    })),
    nextCursor,
  })
}
