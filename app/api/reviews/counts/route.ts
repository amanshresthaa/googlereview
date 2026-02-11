import { handleAuthedGet } from "@/lib/api/handler"
import { getReviewCountsForOrgWithTiming } from "@/lib/reviews/query"

export const runtime = "nodejs"

export async function GET(req: Request) {
  return handleAuthedGet(req, async ({ session }) => {
    const { counts, timing } = await getReviewCountsForOrgWithTiming(session.orgId)

    console.info("[api/reviews/counts][timing]", {
      orgId: session.orgId,
      countsMs: timing.countsMs,
      cacheHit: timing.cacheHit,
    })

    return {
      body: { counts },
      headers: {
        "Server-Timing": `reviews_counts;dur=${timing.countsMs}`,
      },
    }
  })
}
