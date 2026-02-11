import { enqueueJob } from "@/lib/jobs/queue"
import { prisma } from "@/lib/db"
import { handleAuthedPost } from "@/lib/api/handler"
import { ApiError } from "@/lib/api/errors"
import { requireRole } from "@/lib/api/authz"
import { runGenerateFastPath } from "@/lib/jobs/worker"

export const runtime = "nodejs"

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: reviewId } = await ctx.params
  const budgetOverrideRaw = req.headers.get("x-budget-override")
  const budgetOverrideReason = req.headers.get("x-budget-override-reason")
  return handleAuthedPost(
    // Preserve the real request for requestId/headers/idempotency/rate-limit.
    req,
    {
      rateLimitScope: "DRAFT_GENERATE",
      idempotency: { required: true, semanticHeaders: ["x-budget-override", "x-budget-override-reason"] },
      readBody: false,
    },
    async ({ session, requestId }) => {
      requireRole(session, ["OWNER", "MANAGER"], "Only OWNER or MANAGER can generate drafts.")

      const budgetOverride = budgetOverrideRaw === "true"
      if (budgetOverride) {
        requireRole(session, ["OWNER"], "Only OWNER can override AI budget.")
        if (!budgetOverrideReason) {
          throw new ApiError({
            status: 400,
            code: "BAD_REQUEST",
            message: "X-Budget-Override-Reason is required when overriding AI budget.",
            fields: { "x-budget-override-reason": ["Required when x-budget-override=true"] },
          })
        }
      }

      const exists = await prisma.review.findFirst({
        where: { id: reviewId, orgId: session.orgId, location: { enabled: true } },
        select: { id: true },
      })
      if (!exists) throw new ApiError({ status: 404, code: "NOT_FOUND", message: "Review not found." })

      const job = await enqueueJob({
        orgId: session.orgId,
        type: "GENERATE_DRAFT",
        payload: {
          reviewId,
          requestedBy: "MANUAL",
          budgetOverride: budgetOverride ? { enabled: true, reason: budgetOverrideReason } : { enabled: false },
        },
        dedupKey: `review:${reviewId}:request:${requestId}`,
        triggeredByRequestId: requestId,
        triggeredByUserId: session.user.id,
      })

      await prisma.auditLog.create({
        data: {
          orgId: session.orgId,
          actorUserId: session.user.id,
          action: "DRAFT_GENERATE_REQUESTED",
          entityType: "Review",
          entityId: reviewId,
          metadataJson: {
            jobId: job.id,
            budgetOverride: budgetOverride ? { enabled: true, reason: budgetOverrideReason } : { enabled: false },
          } as never,
        },
      })

      // Fast-path generate: bounded and generate-only, and only for this request's job.
      const worker = await runGenerateFastPath({
        jobId: job.id,
        orgId: session.orgId,
        workerId: `fastpath:${requestId}`,
        budgetMs: 2500,
      })

      return { body: { jobId: job.id, worker } }
    }
  )
}
