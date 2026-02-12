import crypto from "node:crypto"
import { z } from "zod"

import { handleAuthedPost } from "@/lib/api/handler"
import { ApiError } from "@/lib/api/errors"
import { zodFields } from "@/lib/api/validation"
import { runWorkerOnceForOrg } from "@/lib/jobs/worker"
import { assertOwner } from "@/lib/jobs/system-health"

export const runtime = "nodejs"

const bodySchema = z.object({
  limit: z.coerce.number().int().min(1).max(5).optional(),
})

export async function POST(req: Request) {
  return handleAuthedPost(
    req,
    {
      rateLimitScope: "JOBS_ADMIN",
      idempotency: { required: true },
    },
    async ({ session, body }) => {
      assertOwner(session.role ?? "")

      // When deploying a beta build against a shared production database, we must
      // prevent double-processing by ensuring only one deployment runs the worker.
      if (process.env.DISABLE_CRON === "true") {
        throw new ApiError({
          status: 503,
          code: "WORKER_DISABLED",
          message: "Worker execution is disabled for this deployment.",
        })
      }

      const parsed = bodySchema.safeParse(body ?? {})
      if (!parsed.success) {
        const { details, fields } = zodFields(parsed.error)
        throw new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid body.", details, fields })
      }

      // Keep this endpoint safe for interactive use: small default limit.
      const limit = parsed.data.limit ?? 1
      const workerId = crypto.randomUUID()
      const run = await runWorkerOnceForOrg({ orgId: session.orgId, limit, workerId })

      return {
        body: {
          worker: run,
        },
      }
    },
  )
}
