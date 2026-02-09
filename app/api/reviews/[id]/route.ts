import { NextResponse } from "next/server"
import { requireApiSession } from "@/lib/session"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiSession()
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })

  const { id } = await ctx.params
  const review = await prisma.review.findFirst({
    where: { id, orgId: session.orgId },
    include: {
      location: true,
      currentDraftReply: true,
      drafts: { orderBy: { version: "desc" }, take: 10 },
    },
  })

  if (!review) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })

  return NextResponse.json({
    id: review.id,
    starRating: review.starRating,
    comment: review.comment,
    createTime: review.createTime.toISOString(),
    updateTime: review.updateTime.toISOString(),
    reviewer: {
      displayName: review.reviewerDisplayName,
      isAnonymous: review.reviewerIsAnonymous,
    },
    reply: {
      comment: review.googleReplyComment,
      updateTime: review.googleReplyUpdateTime?.toISOString() ?? null,
    },
    location: { id: review.location.id, name: review.location.displayName },
    mentions: review.mentions,
    currentDraft: review.currentDraftReply,
    drafts: review.drafts,
  })
}

