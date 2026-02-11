import { z } from "zod"
import { reviewsFilterSchema } from "@/lib/reviews/listing"
import { listReviewsPage } from "@/lib/reviews/query"
import { handleAuthedGet } from "@/lib/api/handler"
import { ApiError } from "@/lib/api/errors"
import { zodFields } from "@/lib/api/validation"

export const runtime = "nodejs"

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
    const mention = parsed.data.mention
    const take = parsed.data.limit ?? 50

    let page
    try {
      page = await listReviewsPage({
        orgId: session.orgId,
        filter,
        mention,
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
