import { z } from "zod"
import { handleAuthedPost } from "@/lib/api/handler"
import { ApiError } from "@/lib/api/errors"
import { zodFields } from "@/lib/api/validation"
import { assertOwner, applyJobActionForOrg, getJobDetailForOrg } from "@/lib/jobs/system-health"
import { jobActionSchema } from "@/lib/jobs/system-health.schemas"

export const runtime = "nodejs"

const paramsSchema = z.object({ id: z.string().min(1) })

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleAuthedPost(
    req,
    { rateLimitScope: "JOBS_ADMIN", idempotency: { required: true } },
    async ({ session, requestId, body }) => {
      assertOwner(session.role ?? "")

      const raw = await ctx.params
      const parsedParams = paramsSchema.safeParse(raw)
      if (!parsedParams.success) {
        const { details, fields } = zodFields(parsedParams.error)
        throw new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid params.", details, fields })
      }

      const parsedAction = jobActionSchema.safeParse(body)
      if (!parsedAction.success) {
        const { details, fields } = zodFields(parsedAction.error)
        throw new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid action.", details, fields })
      }

      const result = await applyJobActionForOrg({
        orgId: session.orgId,
        jobId: parsedParams.data.id,
        action: parsedAction.data,
        requestId,
        actorUserId: session.user.id,
      })

      const updated = await getJobDetailForOrg({
        orgId: session.orgId,
        jobId: result.kind === "REQUEUED" ? result.newJobId : result.jobId,
        includePayload: true,
      })

      return {
        body: {
          result,
          job: updated,
        },
      }
    },
  )
}

