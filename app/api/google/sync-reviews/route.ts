import { z } from "zod"
import { prisma } from "@/lib/db"
import { enqueueJob } from "@/lib/jobs/queue"
import { handleAuthedPost } from "@/lib/api/handler"
import { ApiError } from "@/lib/api/errors"
import { zodFields } from "@/lib/api/validation"
import { requireRole } from "@/lib/api/authz"

export const runtime = "nodejs"

const MAX_LOCATIONS_PER_REQUEST = 200

const bodySchema = z
  .object({
    locationIds: z.array(z.string().min(1)).max(MAX_LOCATIONS_PER_REQUEST).optional(),
  })
  .strict()

export async function POST(req: Request) {
  return handleAuthedPost(
    req,
    { rateLimitScope: "GOOGLE_SYNC_REVIEWS", idempotency: { required: true } },
    async ({ session, requestId, body }) => {
      requireRole(session, ["OWNER", "MANAGER"], "Only OWNER or MANAGER can sync reviews.")

      const parsed = bodySchema.safeParse(body ?? {})
      if (!parsed.success) {
        const { details, fields } = zodFields(parsed.error)
        throw new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid request body.", details, fields })
      }

      const requestedIds = parsed.data.locationIds?.map((id) => id.trim()).filter(Boolean) ?? []
      const uniqueIds = Array.from(new Set(requestedIds))

      let locations: Array<{ id: string }> = []
      if (uniqueIds.length) {
        locations = await prisma.location.findMany({
          where: { orgId: session.orgId, id: { in: uniqueIds }, enabled: true },
          select: { id: true },
        })

        const found = new Set(locations.map((l) => l.id))
        const missing = uniqueIds.filter((id) => !found.has(id))
        if (missing.length) {
          throw new ApiError({
            status: 404,
            code: "NOT_FOUND",
            message: "Some locations were not found or are not enabled.",
            details: { missingLocationIds: missing },
          })
        }
      } else {
        locations = await prisma.location.findMany({
          where: { orgId: session.orgId, enabled: true },
          select: { id: true },
          take: MAX_LOCATIONS_PER_REQUEST + 1,
        })
        if (locations.length > MAX_LOCATIONS_PER_REQUEST) {
          throw new ApiError({
            status: 400,
            code: "BAD_REQUEST",
            message: `Too many enabled locations to sync at once. Provide locationIds (max ${MAX_LOCATIONS_PER_REQUEST}).`,
          })
        }
      }

      if (locations.length === 0) {
        throw new ApiError({ status: 400, code: "BAD_REQUEST", message: "No enabled locations to sync." })
      }

      const jobIds: string[] = []
      for (const location of locations) {
        const job = await enqueueJob({
          orgId: session.orgId,
          type: "SYNC_REVIEWS",
          payload: { locationId: location.id },
          dedupKey: `loc:${location.id}`,
          triggeredByRequestId: requestId,
          triggeredByUserId: session.user.id,
        })
        jobIds.push(job.id)
      }

      await prisma.auditLog.create({
        data: {
          orgId: session.orgId,
          actorUserId: session.user.id,
          action: "SYNC_REVIEWS_TRIGGERED",
          entityType: "Organization",
          entityId: session.orgId,
          metadataJson: {
            locationIds: locations.map((l) => l.id).slice(0, 20),
            requestedCount: locations.length,
            jobIds: jobIds.slice(0, 20),
          } as never,
        },
      })

      return { body: { jobIds, worker: { claimed: 0, results: [] } } }
    }
  )
}
