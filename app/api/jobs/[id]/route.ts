import { z } from "zod"
import { ApiError } from "@/lib/api/errors"
import { zodFields } from "@/lib/api/validation"
import { handleAuthedGet } from "@/lib/api/handler"
import { getJobDetailForOrg, isTerminalJobStatus } from "@/lib/jobs/system-health"

export const runtime = "nodejs"

const paramsSchema = z.object({ id: z.string().min(1) })

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleAuthedGet(req, async ({ session }) => {
    const url = new URL(req.url)
    const raw = await ctx.params
    const parsed = paramsSchema.safeParse(raw)
    if (!parsed.success) {
      const { details, fields } = zodFields(parsed.error)
      throw new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid params.", details, fields })
    }

    const includeDspyLatest = url.searchParams.get("includeDspyLatest") === "1"

    const job = await getJobDetailForOrg({
      orgId: session.orgId,
      jobId: parsed.data.id,
      includePayload: true,
      includeDspyLatest,
    })

    const lastErrorMeta = job.lastErrorMeta ?? null
    const metaRetryAfter = typeof lastErrorMeta?.retryAfterSec === "number" ? lastErrorMeta.retryAfterSec : null
    const computedRetryAfter = Math.ceil((new Date(job.runAtIso).getTime() - Date.now()) / 1000)
    const retryAfterSec =
      metaRetryAfter ??
      (job.status === "RETRYING" && computedRetryAfter > 0 ? computedRetryAfter : null)

    const isTerminal = isTerminalJobStatus(job.status)
    const headers: Record<string, string> = {
      "Cache-Control": isTerminal ? "private, max-age=10, stale-while-revalidate=30" : "private, no-store",
    }
    if (retryAfterSec != null && retryAfterSec > 0) {
      headers["Retry-After"] = String(retryAfterSec)
    }

    return {
      body: {
        job: {
          ...job,
          retryAfterSec,
        },
      },
      headers,
    }
  })
}
