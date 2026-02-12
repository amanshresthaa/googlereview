import { handleAuthedPost } from "@/lib/api/handler"
import { ApiError } from "@/lib/api/errors"
import { zodFields } from "@/lib/api/validation"
import { assertOwner, applyBulkJobActionForOrg } from "@/lib/jobs/system-health"
import { bulkJobActionSchema } from "@/lib/jobs/system-health.schemas"

export const runtime = "nodejs"

export async function POST(req: Request) {
  return handleAuthedPost(
    req,
    { rateLimitScope: "JOBS_ADMIN", idempotency: { required: true } },
    async ({ session, requestId, body }) => {
      assertOwner(session.role ?? "")

      const parsed = bulkJobActionSchema.safeParse(body)
      if (!parsed.success) {
        const { details, fields } = zodFields(parsed.error)
        throw new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid action.", details, fields })
      }

      const result = await applyBulkJobActionForOrg({
        orgId: session.orgId,
        action: parsed.data,
        requestId,
        actorUserId: session.user.id,
      })

      return { body: { result } }
    },
  )
}

