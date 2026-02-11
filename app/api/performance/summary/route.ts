import { z } from "zod"
import { getPerformanceSummary } from "@/lib/performance"
import { handleAuthedGet } from "@/lib/api/handler"
import { ApiError } from "@/lib/api/errors"
import { zodFields } from "@/lib/api/validation"

export const runtime = "nodejs"

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional(),
})

export async function GET(req: Request) {
  return handleAuthedGet(req, async ({ session, url }) => {
    const parsed = querySchema.safeParse({
      days: url.searchParams.get("days") ?? undefined,
    })
    if (!parsed.success) {
      const { details, fields } = zodFields(parsed.error)
      throw new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid query.", details, fields })
    }

    const days = parsed.data.days ?? 30
    const summary = await getPerformanceSummary({ orgId: session.orgId, days })

    return {
      body: {
        range: summary.range,
        kpis: summary.kpis,
        series: summary.series,
      },
    }
  })
}
