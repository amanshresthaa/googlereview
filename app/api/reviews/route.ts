import { z } from "zod"
import { reviewsFilterSchema, reviewsStatusSchema } from "@/lib/reviews/listing"
import { listReviewsPage } from "@/lib/reviews/query"
import { REVIEWS_PAGE_SIZE } from "@/lib/reviews/constants"
import { handleAuthedGet } from "@/lib/api/handler"
import { ApiError } from "@/lib/api/errors"
import { zodFields } from "@/lib/api/validation"

export const runtime = "nodejs"

const querySchema = z.object({
  filter: reviewsFilterSchema.optional(),
  status: reviewsStatusSchema.optional(),
  mention: z.string().optional(),
  locationId: z.string().min(1).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  search: z.string().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(REVIEWS_PAGE_SIZE).optional(),
  cursor: z.string().optional(),
})

export async function GET(req: Request) {
  return handleAuthedGet(req, async ({ session, url }) => {
    const parsed = querySchema.safeParse({
      filter: url.searchParams.get("filter") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      mention: url.searchParams.get("mention") ?? undefined,
      locationId: url.searchParams.get("locationId") ?? undefined,
      rating: url.searchParams.get("rating") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
    })
    if (!parsed.success) {
      const { details, fields } = zodFields(parsed.error)
      throw new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid query.", details, fields })
    }

    const filter = parsed.data.filter ?? "unanswered"
    const status = parsed.data.status ?? "all"
    const mention = parsed.data.mention
    const locationId = parsed.data.locationId
    const rating = parsed.data.rating
    const search = parsed.data.search
    const take = parsed.data.limit ?? REVIEWS_PAGE_SIZE

    let page
    try {
      page = await listReviewsPage({
        orgId: session.orgId,
        filter,
        status,
        mention,
        locationId,
        rating,
        search,
        limit: take,
        cursor: parsed.data.cursor,
      })
    } catch (error) {
      if (error instanceof Error && error.message === "BAD_CURSOR") {
        throw new ApiError({ status: 400, code: "BAD_CURSOR", message: "Invalid cursor." })
      }
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

    return {
      body: page,
    }
  })
}
