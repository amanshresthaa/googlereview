import { handleAuthedGet } from "@/lib/api/handler"
import { ApiError } from "@/lib/api/errors"
import { getReviewDetailForOrg } from "@/lib/reviews/detail"

export const runtime = "nodejs"

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return handleAuthedGet(req, async ({ session }) => {
    const review = await getReviewDetailForOrg({ reviewId: id, orgId: session.orgId })
    if (!review) throw new ApiError({ status: 404, code: "NOT_FOUND", message: "Review not found." })
    return { body: review }
  })
}
