import { z } from "zod"
import { revalidateTag } from "next/cache"
import { prisma } from "@/lib/db"
import { enqueueJob } from "@/lib/jobs/queue"
import { handleAuthedPost } from "@/lib/api/handler"
import { ApiError } from "@/lib/api/errors"
import { zodFields } from "@/lib/api/validation"
import { requireRole } from "@/lib/api/authz"
import { sidebarCacheTag } from "@/lib/sidebar-data"

export const runtime = "nodejs"

const bodySchema = z
  .object({
    enabledLocationIds: z.array(z.string().min(1)).max(200),
  })
  .strict()

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

      const normalizedLocationIds = parsed.data.enabledLocationIds.map((id) => id.trim()).filter(Boolean)
      const enabledIds = Array.from(new Set(normalizedLocationIds))
      if (enabledIds.length !== normalizedLocationIds.length) {
        throw new ApiError({
          status: 400,
          code: "BAD_REQUEST",
          message: "Duplicate enabledLocationIds are not allowed.",
          fields: { enabledLocationIds: ["Each location id can appear only once."] },
        })
      }

      if (enabledIds.length > 0) {
        const existingLocations = await prisma.location.findMany({
          where: { orgId: session.orgId, id: { in: enabledIds } },
          select: { id: true },
        })
        const existingIds = new Set(existingLocations.map((location) => location.id))
        const missingLocationIds = enabledIds.filter((id) => !existingIds.has(id))
        if (missingLocationIds.length > 0) {
          throw new ApiError({
            status: 404,
            code: "NOT_FOUND",
            message: "One or more locations were not found.",
            details: { missingLocationIds },
          })
        }
      }

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
              requestedCount: normalizedLocationIds.length,
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

      revalidateTag(sidebarCacheTag(session.orgId), "max")

      return { body: { enabledCount: enabledIds.length, worker: { claimed: 0, results: [] } } }
    }
  )
}
