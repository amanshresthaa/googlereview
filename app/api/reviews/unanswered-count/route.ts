import { handleAuthedGet } from "@/lib/api/handler"
import { getReviewCountsForOrg } from "@/lib/reviews/query"

export const runtime = "nodejs"

export async function GET(req: Request) {
  return handleAuthedGet(req, async ({ session }) => {
    const counts = await getReviewCountsForOrg(session.orgId)

    return {
      body: { count: counts.unanswered },
      headers: {
        "Cache-Control": "private, max-age=10, stale-while-revalidate=20",
      },
    }
  })
}
