import { z } from "zod"
import { prisma } from "@/lib/db"
import { enqueueJob } from "@/lib/jobs/queue"
import { handleAuthedPost } from "@/lib/api/handler"
import { ApiError } from "@/lib/api/errors"
import { zodFields } from "@/lib/api/validation"
import { requireRole } from "@/lib/api/authz"

export const runtime = "nodejs"

const bodySchema = z.object({
  enabledLocationIds: z.array(z.string().min(1)).max(200),
})

export async function POST(req: Request) {
  return handleAuthedPost(
    req,
    { rateLimitScope: "LOCATIONS_SELECT", idempotency: { required: true } },
    async ({ session, requestId, body }) => {
      requireRole(session, ["OWNER"], "Only OWNER can select locations.")

      const parsed = bodySchema.safeParse(body)
      if (!parsed.success) {
        const { details, fields } = zodFields(parsed.error)
        throw new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid request body.", details, fields })
      }

      const enabledIds = parsed.data.enabledLocationIds

      await prisma.$transaction(async (tx) => {
        await tx.location.updateMany({
          where: { orgId: session.orgId, enabled: true, id: { notIn: enabledIds } },
          data: { enabled: false },
        })

        await tx.location.updateMany({
          where: { orgId: session.orgId, id: { in: enabledIds } },
          data: { enabled: true },
        })

        await tx.auditLog.create({
          data: {
            orgId: session.orgId,
            actorUserId: session.user.id,
            action: "LOCATIONS_SELECTED",
            entityType: "Organization",
            entityId: session.orgId,
            metadataJson: {
              enabledCount: enabledIds.length,
              enabledLocationIds: enabledIds.slice(0, 20),
            } as never,
          },
        })
      })

      for (const locationId of enabledIds) {
        await enqueueJob({
          orgId: session.orgId,
          type: "SYNC_REVIEWS",
          payload: { locationId },
          dedupKey: `loc:${locationId}`,
          triggeredByRequestId: requestId,
          triggeredByUserId: session.user.id,
        })
      }

      return { body: { worker: { claimed: 0, results: [] } } }
    }
  )
}
