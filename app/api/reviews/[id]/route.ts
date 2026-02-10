import { prisma } from "@/lib/db"
import { handleAuthedGet } from "@/lib/api/handler"
import { ApiError } from "@/lib/api/errors"

export const runtime = "nodejs"

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return handleAuthedGet(req, async ({ session }) => {
    const review = await prisma.review.findFirst({
      where: { id, orgId: session.orgId, location: { enabled: true } },
      include: {
        location: true,
        currentDraftReply: true,
        drafts: { orderBy: { version: "desc" }, take: 10 },
      },
    })

    if (!review) throw new ApiError({ status: 404, code: "NOT_FOUND", message: "Review not found." })

    return {
      body: {
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
      },
    }
  })
}
