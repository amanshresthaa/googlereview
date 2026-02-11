import { z } from "zod"
import { ApiError } from "@/lib/api/errors"
import { handleAuthedGet } from "@/lib/api/handler"
import { zodFields } from "@/lib/api/validation"
import { reviewsFilterSchema, reviewsStatusSchema } from "@/lib/reviews/listing"
import { fetchInboxBootstrap } from "@/lib/reviews/bootstrap"

export const runtime = "nodejs"

const querySchema = z.object({
  filter: reviewsFilterSchema.optional(),
  status: reviewsStatusSchema.optional(),
  mention: z.string().optional(),
  locationId: z.string().min(1).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  search: z.string().max(120).optional(),
  includeCounts: z.enum(["0", "1"]).optional(),
})

export async function GET(req: Request) {
  return handleAuthedGet(req, async ({ session, url }) => {
    const requestStartedAt = Date.now()
    const parsed = querySchema.safeParse({
      filter: url.searchParams.get("filter") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      mention: url.searchParams.get("mention") ?? undefined,
      locationId: url.searchParams.get("locationId") ?? undefined,
      rating: url.searchParams.get("rating") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      includeCounts: url.searchParams.get("includeCounts") ?? undefined,
    })

    if (!parsed.success) {
      const { details, fields } = zodFields(parsed.error)
      throw new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid query.", details, fields })
    }

    const includeCounts = parsed.data.includeCounts === "1"

    let body: Awaited<ReturnType<typeof fetchInboxBootstrap>>
    try {
      body = await fetchInboxBootstrap({
        orgId: session.orgId,
        filter: parsed.data.filter,
        status: parsed.data.status,
        mention: parsed.data.mention,
        locationId: parsed.data.locationId,
        rating: parsed.data.rating,
        search: parsed.data.search,
        includeCounts,
      })
    } catch (error) {
      if (error instanceof Error && error.message === "MENTION_REQUIRED") {
        throw new ApiError({
          status: 400,
          code: "BAD_REQUEST",
          message: "mention is required when filter=mentions.",
          fields: { mention: ["Required for mentions filter"] },
        })
      }
      throw error
    }

    const totalMs = Date.now() - requestStartedAt
    const serverTiming = `inbox_bootstrap_total;dur=${totalMs}`

    console.info("[api/inbox/bootstrap][timing]", {
      orgId: session.orgId,
      filter: parsed.data.filter ?? "unanswered",
      status: parsed.data.status ?? "all",
      includeCountsRequested: includeCounts,
      rowCount: body.initialPage?.rows?.length ?? 0,
      hasMore: Boolean(body.initialPage?.nextCursor),
      totalMs,
    })

    return {
      body,
      headers: {
        "Server-Timing": serverTiming,
        "Cache-Control": "private, max-age=5, stale-while-revalidate=30",
      },
    }
  })
}
