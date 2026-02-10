import { enqueueJob } from "@/lib/jobs/queue"
import { handleAuthedPost } from "@/lib/api/handler"
import { requireRole } from "@/lib/api/authz"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

export async function POST(req: Request) {
  return handleAuthedPost(
    req,
    { rateLimitScope: "GOOGLE_SYNC_LOCATIONS", idempotency: { required: true } },
    async ({ session, requestId }) => {
      requireRole(session, ["OWNER"], "Only OWNER can sync locations.")

      const job = await enqueueJob({
        orgId: session.orgId,
        type: "SYNC_LOCATIONS",
        payload: {},
        dedupKey: `org:${session.orgId}`,
        triggeredByRequestId: requestId,
        triggeredByUserId: session.user.id,
      })

      await prisma.auditLog.create({
        data: {
          orgId: session.orgId,
          actorUserId: session.user.id,
          action: "SYNC_LOCATIONS_TRIGGERED",
          entityType: "Organization",
          entityId: session.orgId,
          metadataJson: { jobId: job.id } as never,
        },
      })

      return { body: { jobId: job.id, worker: { claimed: 0, results: [] } } }
    }
  )
}
