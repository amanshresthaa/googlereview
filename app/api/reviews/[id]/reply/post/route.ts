import { prisma } from "@/lib/db"
import { enqueueJob } from "@/lib/jobs/queue"
import { handleAuthedPost } from "@/lib/api/handler"
import { ApiError } from "@/lib/api/errors"
import { requireRole } from "@/lib/api/authz"
import { runPostReplyFastPath } from "@/lib/jobs/worker"
import { after } from "next/server"

export const runtime = "nodejs"

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: reviewId } = await ctx.params
  return handleAuthedPost(
    req,
    { rateLimitScope: "REPLY_POST", idempotency: { required: true } , readBody: false},
    async ({ session, requestId }) => {
      requireRole(session, ["OWNER", "MANAGER"], "Only OWNER or MANAGER can post replies.")

      const review = await prisma.review.findFirst({
        where: { id: reviewId, orgId: session.orgId, location: { enabled: true } },
        select: {
          googleReplyComment: true,
          currentDraftReplyId: true,
          currentDraftReply: { select: { status: true } },
        },
      })

      if (!review) throw new ApiError({ status: 404, code: "NOT_FOUND", message: "Review not found." })
      if (review.googleReplyComment) throw new ApiError({ status: 409, code: "ALREADY_REPLIED", message: "Already replied." })
      if (!review.currentDraftReplyId) throw new ApiError({ status: 400, code: "NO_DRAFT", message: "No draft." })
      if (review.currentDraftReply?.status !== "READY") {
        // Fail-fast: don't enqueue POST_REPLY jobs that are guaranteed to fail.
        throw new ApiError({ status: 409, code: "DRAFT_NOT_READY", message: "Draft is not READY." })
      }

      const job = await enqueueJob({
        orgId: session.orgId,
        type: "POST_REPLY",
        payload: { draftReplyId: review.currentDraftReplyId, actorUserId: session.user.id },
        dedupKey: `review:${reviewId}:post`,
        triggeredByRequestId: requestId,
        triggeredByUserId: session.user.id,
      })

      await prisma.auditLog.create({
        data: {
          orgId: session.orgId,
          actorUserId: session.user.id,
          action: "REPLY_POST_REQUESTED",
          entityType: "Review",
          entityId: reviewId,
          metadataJson: { jobId: job.id } as never,
        },
      })

      // Best-effort post-response kick so users don't wait for cron cadence.
      // This never blocks the API response and queue execution remains canonical.
      const runFastPath = async () => {
        try {
          await runPostReplyFastPath({
            jobId: job.id,
            orgId: session.orgId,
            workerId: `fastpath:${requestId}`,
            budgetMs: 2500,
          })
        } catch (error) {
          console.warn("[api/reviews][reply/post][fastpath] failed", {
            orgId: session.orgId,
            reviewId,
            jobId: job.id,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
      try {
        after(runFastPath)
      } catch {
        void runFastPath()
      }

      return {
        status: 202,
        body: {
          accepted: true,
          jobId: job.id,
          job: { id: job.id, status: job.status },
          review: null,
          worker: { claimed: 0 },
        },
      }
    }
  )
}
