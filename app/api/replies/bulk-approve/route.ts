import { z } from "zod"
import { prisma } from "@/lib/db"
import { enqueueJob } from "@/lib/jobs/queue"
import { handleAuthedPost } from "@/lib/api/handler"
import { ApiError } from "@/lib/api/errors"
import { zodFields } from "@/lib/api/validation"
import { requireRole } from "@/lib/api/authz"

export const runtime = "nodejs"

const bodySchema = z.object({
  reviewIds: z.array(z.string().min(1)).min(1).max(50),
})

export async function POST(req: Request) {
  return handleAuthedPost(
    req,
    { rateLimitScope: "BULK_APPROVE", idempotency: { required: true } },
    async ({ session, requestId, body }) => {
      requireRole(session, ["OWNER"], "Only OWNER can bulk approve.")

      const settings = await prisma.orgSettings.findUnique({ where: { orgId: session.orgId } })
      if (settings?.bulkApproveEnabledForFiveStar === false) {
        throw new ApiError({ status: 403, code: "BULK_APPROVE_DISABLED", message: "Bulk approve is disabled." })
      }

      const parsed = bodySchema.safeParse(body)
      if (!parsed.success) {
        const { details, fields } = zodFields(parsed.error)
        throw new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid request body.", details, fields })
      }

      const reviews = await prisma.review.findMany({
        where: {
          orgId: session.orgId,
          id: { in: parsed.data.reviewIds },
          location: { enabled: true },
          starRating: 5,
          googleReplyComment: null,
        },
        include: { currentDraftReply: true },
      })

      const invalid = reviews.filter((r) => r.currentDraftReply?.status !== "READY")
      if (invalid.length) {
        throw new ApiError({
          status: 400,
          code: "BAD_REQUEST",
          message: "Some reviews are not eligible for bulk approval.",
          details: { notReady: invalid.map((r) => r.id) },
        })
      }

      const jobs: string[] = []
      for (const r of reviews) {
        if (!r.currentDraftReplyId) continue
        const job = await enqueueJob({
          orgId: session.orgId,
          type: "POST_REPLY",
          payload: { draftReplyId: r.currentDraftReplyId, actorUserId: session.user.id },
          dedupKey: `review:${r.id}`,
          triggeredByRequestId: requestId,
          triggeredByUserId: session.user.id,
        })
        jobs.push(job.id)
      }

      await prisma.auditLog.create({
        data: {
          orgId: session.orgId,
          actorUserId: session.user.id,
          action: "BULK_APPROVE_REQUESTED",
          entityType: "Review",
          entityId: "bulk",
          metadataJson: { count: reviews.length, reviewIds: reviews.map((r) => r.id).slice(0, 50) } as never,
        },
      })

      return { body: { jobIds: jobs, worker: { claimed: 0, results: [] } } }
    }
  )
}
