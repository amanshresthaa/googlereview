import { prisma } from "@/lib/db"
import { enqueueJob } from "@/lib/jobs/queue"
import { handleAuthedPost } from "@/lib/api/handler"
import { ApiError } from "@/lib/api/errors"
import { requireRole } from "@/lib/api/authz"
import { runVerifyFastPath } from "@/lib/jobs/worker"

export const runtime = "nodejs"

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: reviewId } = await ctx.params
  const budgetOverrideRaw = req.headers.get("x-budget-override")
  const budgetOverrideReason = req.headers.get("x-budget-override-reason")

  return handleAuthedPost(
    req,
    {
      rateLimitScope: "DRAFT_VERIFY",
      idempotency: { required: true, semanticHeaders: ["x-budget-override", "x-budget-override-reason"] },
      readBody: false,
    },
    async ({ session, requestId }) => {
      requireRole(session, ["OWNER", "MANAGER"], "Only OWNER or MANAGER can verify drafts.")

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

      const review = await prisma.review.findFirst({
        where: { id: reviewId, orgId: session.orgId, location: { enabled: true } },
        select: { currentDraftReplyId: true },
      })
      if (!review) throw new ApiError({ status: 404, code: "NOT_FOUND", message: "Review not found." })
      if (!review.currentDraftReplyId) throw new ApiError({ status: 400, code: "NO_DRAFT", message: "No draft." })

      const draftId = review.currentDraftReplyId
      const job = await enqueueJob({
        orgId: session.orgId,
        type: "VERIFY_DRAFT",
        payload: {
          draftReplyId: draftId,
          budgetOverride: budgetOverride ? { enabled: true, reason: budgetOverrideReason } : { enabled: false },
        },
        dedupKey: `draft:${draftId}`,
        triggeredByRequestId: requestId,
        triggeredByUserId: session.user.id,
      })

      await prisma.auditLog.create({
        data: {
          orgId: session.orgId,
          actorUserId: session.user.id,
          action: "DRAFT_VERIFY_REQUESTED",
          entityType: "DraftReply",
          entityId: draftId,
          metadataJson: {
            jobId: job.id,
            budgetOverride: budgetOverride ? { enabled: true, reason: budgetOverrideReason } : { enabled: false },
          } as never,
        },
      })

      // Fast-path verify: bounded and verify-only, and only for the job created by this request.
      // We currently only run fast-path when the org uses OPENAI since we can enforce AbortSignal timeouts.
      const settings = await prisma.orgSettings.findUnique({ where: { orgId: session.orgId }, select: { aiProvider: true } })
      const provider = settings?.aiProvider ?? "OPENAI"

      const worker =
        provider === "OPENAI"
          ? await runVerifyFastPath({
              jobId: job.id,
              orgId: session.orgId,
              workerId: `fastpath:${requestId}`,
              budgetMs: 2000,
            })
          : { claimed: 0, results: [] as Array<{ id: string; ok: boolean; error?: string }> }

      return { body: { jobId: job.id, worker } }
    }
  )
}
