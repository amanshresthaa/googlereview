import { prisma } from "@/lib/db"
import { enqueueJob } from "@/lib/jobs/queue"
import { handleAuthedPost } from "@/lib/api/handler"
import { ApiError } from "@/lib/api/errors"
import { requireRole } from "@/lib/api/authz"
import { runProcessReviewFastPath } from "@/lib/jobs/worker"
import { dspyEnv } from "@/lib/env"
import { getReviewDetailForOrg } from "@/lib/reviews/detail"
import { processReviewFailureToApiError } from "@/lib/jobs/process-review-api-error"

export const runtime = "nodejs"

function computeInteractiveBudgetMs() {
  const e = dspyEnv()
  const timeoutMs = e.DSPY_HTTP_TIMEOUT_MS ?? 12_000
  return Math.min(15_000, Math.max(5_000, timeoutMs + 750))
}

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
      const dedupKey = `draft:${draftId}:verify`
      const inflight = await prisma.job.findFirst({
        where: {
          orgId: session.orgId,
          type: "PROCESS_REVIEW",
          dedupKey,
          status: { in: ["PENDING", "RUNNING", "RETRYING"] },
        },
        select: { id: true },
      })
      if (inflight) {
        throw new ApiError({
          status: 409,
          code: "DEDUP_INFLIGHT",
          message: "Draft verification is already in progress.",
          details: { jobId: inflight.id },
        })
      }

      const job = await enqueueJob({
        orgId: session.orgId,
        type: "PROCESS_REVIEW",
        payload: {
          reviewId,
          mode: "VERIFY_EXISTING_DRAFT",
          draftReplyId: draftId,
          budgetOverride: budgetOverride ? { enabled: true, reason: budgetOverrideReason } : { enabled: false },
        },
        dedupKey,
        maxAttemptsOverride: 1,
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

      const worker = await runProcessReviewFastPath({
        jobId: job.id,
        orgId: session.orgId,
        workerId: `fastpath:${requestId}`,
        budgetMs: computeInteractiveBudgetMs(),
      })

      const updated = await prisma.job.findUnique({
        where: { id: job.id },
        select: { status: true, lastError: true, lastErrorCode: true, lastErrorMetaJson: true },
      })
      if (updated?.status === "FAILED") {
        throw processReviewFailureToApiError({
          operation: "verification",
          lastErrorCode: updated.lastErrorCode,
          lastError: updated.lastError,
          lastErrorMetaJson: updated.lastErrorMetaJson,
        })
      }

      const reviewSnapshot = await getReviewDetailForOrg({
        reviewId,
        orgId: session.orgId,
      })

      return {
        status: 200,
        body: {
          jobId: job.id,
          job: { id: job.id, status: job.status },
          review: reviewSnapshot,
          worker,
        },
      }
    }
  )
}
