import { z } from "zod"
import { prisma } from "@/lib/db"
import { enqueueJob } from "@/lib/jobs/queue"
import { handleAuthedPost } from "@/lib/api/handler"
import { ApiError } from "@/lib/api/errors"
import { zodFields } from "@/lib/api/validation"
import { requireRole } from "@/lib/api/authz"

export const runtime = "nodejs"

const bodySchema = z
  .object({
    reviewIds: z.array(z.string().min(1)).min(1).max(50),
  })
  .strict()

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

      const normalizedReviewIds = parsed.data.reviewIds.map((id) => id.trim()).filter(Boolean)
      const uniqueReviewIds = Array.from(new Set(normalizedReviewIds))
      if (uniqueReviewIds.length === 0) {
        throw new ApiError({
          status: 400,
          code: "BAD_REQUEST",
          message: "At least one reviewId is required.",
          fields: { reviewIds: ["Provide at least one review id."] },
        })
      }
      if (uniqueReviewIds.length !== normalizedReviewIds.length) {
        throw new ApiError({
          status: 400,
          code: "BAD_REQUEST",
          message: "Duplicate reviewIds are not allowed.",
          fields: { reviewIds: ["Each review id can appear only once."] },
        })
      }

      const reviews = await prisma.review.findMany({
        where: {
          orgId: session.orgId,
          id: { in: uniqueReviewIds },
        },
        select: {
          id: true,
          starRating: true,
          googleReplyComment: true,
          currentDraftReplyId: true,
          currentDraftReply: { select: { status: true } },
          location: { select: { enabled: true } },
        },
      })

      const foundReviewIds = new Set(reviews.map((review) => review.id))
      const missingReviewIds = uniqueReviewIds.filter((id) => !foundReviewIds.has(id))
      if (missingReviewIds.length > 0) {
        throw new ApiError({
          status: 404,
          code: "NOT_FOUND",
          message: "One or more reviews were not found.",
          details: { missingReviewIds },
        })
      }

      const ineligible = {
        disabledLocationIds: [] as string[],
        alreadyRepliedIds: [] as string[],
        notFiveStarIds: [] as string[],
        noDraftIds: [] as string[],
        notReadyIds: [] as string[],
      }

      for (const review of reviews) {
        if (review.location?.enabled !== true) ineligible.disabledLocationIds.push(review.id)
        if (review.googleReplyComment) ineligible.alreadyRepliedIds.push(review.id)
        if (review.starRating !== 5) ineligible.notFiveStarIds.push(review.id)
        if (!review.currentDraftReplyId) ineligible.noDraftIds.push(review.id)
        if (review.currentDraftReply?.status !== "READY") ineligible.notReadyIds.push(review.id)
      }

      if (
        ineligible.disabledLocationIds.length > 0 ||
        ineligible.alreadyRepliedIds.length > 0 ||
        ineligible.notFiveStarIds.length > 0 ||
        ineligible.noDraftIds.length > 0 ||
        ineligible.notReadyIds.length > 0
      ) {
        throw new ApiError({
          status: 400,
          code: "BAD_REQUEST",
          message: "Some reviews are not eligible for bulk approval.",
          details: ineligible,
        })
      }

      const reviewsById = new Map(reviews.map((review) => [review.id, review]))
      const jobs: string[] = []
      for (const reviewId of uniqueReviewIds) {
        const review = reviewsById.get(reviewId)
        if (!review?.currentDraftReplyId) {
          throw new ApiError({
            status: 500,
            code: "INTERNAL",
            message: "Bulk approval precondition check failed.",
          })
        }
        const job = await enqueueJob({
          orgId: session.orgId,
          type: "POST_REPLY",
          payload: {
            reviewId: review.id,
            draftReplyId: review.currentDraftReplyId,
            actorUserId: session.user.id,
          },
          dedupKey: `review:${review.id}:post`,
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
          metadataJson: { count: uniqueReviewIds.length, reviewIds: uniqueReviewIds.slice(0, 50) } as never,
        },
      })

      return {
        body: {
          acceptedCount: uniqueReviewIds.length,
          jobIds: jobs,
          worker: { claimed: 0, results: [] },
        },
      }
    }
  )
}
