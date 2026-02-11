import { z } from "zod"
import { prisma } from "@/lib/db"
import { enqueueJob } from "@/lib/jobs/queue"
import { extractMentionsAndHighlights } from "@/lib/reviews/mentions"
import { handleAuthedPost } from "@/lib/api/handler"
import { ApiError } from "@/lib/api/errors"
import { zodFields } from "@/lib/api/validation"
import { requireRole } from "@/lib/api/authz"
import { runProcessReviewFastPath } from "@/lib/jobs/worker"

export const runtime = "nodejs"

const bodySchema = z.object({
  text: z.string().min(1).max(10_000),
})

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: reviewId } = await ctx.params
  const budgetOverrideRaw = req.headers.get("x-budget-override")
  const budgetOverrideReason = req.headers.get("x-budget-override-reason")

  return handleAuthedPost(
    req,
    {
      rateLimitScope: "DRAFT_EDIT",
      idempotency: { required: true, semanticHeaders: ["x-budget-override", "x-budget-override-reason"] },
    },
    async ({ session, requestId, body }) => {
      requireRole(session, ["OWNER", "MANAGER"], "Only OWNER or MANAGER can edit drafts.")

      const parsed = bodySchema.safeParse(body)
      if (!parsed.success) {
        const { details, fields } = zodFields(parsed.error)
        throw new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid request body.", details, fields })
      }

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
        include: { currentDraftReply: true, location: true },
      })
      if (!review) throw new ApiError({ status: 404, code: "NOT_FOUND", message: "Review not found." })

      const maxVersion = await prisma.draftReply.aggregate({
        where: { reviewId: review.id },
        _max: { version: true },
      })
      const nextVersion = (maxVersion._max.version ?? 0) + 1
      const settings = await prisma.orgSettings.findUnique({ where: { orgId: session.orgId } })
      const mentionKeywords = settings?.mentionKeywords ?? []
      const { highlights, mentions } = extractMentionsAndHighlights(review.comment, mentionKeywords)

      const evidence = {
        starRating: review.starRating,
        comment: review.comment ?? null,
        reviewerDisplayName: review.reviewerDisplayName ?? null,
        reviewerIsAnonymous: review.reviewerIsAnonymous,
        locationDisplayName: review.location.displayName,
        createTime: review.createTime.toISOString(),
        highlights,
        mentionKeywords,
        seoProfile: {
          primaryKeywords: review.location.seoPrimaryKeywords,
          secondaryKeywords: review.location.seoSecondaryKeywords,
          geoTerms: review.location.seoGeoTerms,
        },
        tone: {
          preset: settings?.tonePreset ?? "friendly",
          customInstructions: settings?.toneCustomInstructions ?? null,
        },
      }

      const created = await prisma.$transaction(async (tx) => {
        await tx.review.update({ where: { id: review.id }, data: { mentions } })
        const draft = await tx.draftReply.create({
          data: {
            orgId: session.orgId,
            reviewId: review.id,
            version: nextVersion,
            text: parsed.data.text,
            origin: "USER_EDITED",
            status: "NEEDS_APPROVAL",
            evidenceSnapshotJson: evidence as never,
          },
        })
        await tx.review.update({ where: { id: review.id }, data: { currentDraftReplyId: draft.id } })
        await tx.auditLog.create({
          data: {
            orgId: session.orgId,
            actorUserId: session.user.id,
            action: "DRAFT_EDITED",
            entityType: "Review",
            entityId: review.id,
            metadataJson: {
              draftReplyId: draft.id,
              version: draft.version,
              budgetOverride: budgetOverride ? { enabled: true, reason: budgetOverrideReason } : { enabled: false },
            } as never,
          },
        })
        return draft
      })

      const verifyJob = await enqueueJob({
        orgId: session.orgId,
        type: "PROCESS_REVIEW",
        payload: {
          reviewId: review.id,
          mode: "VERIFY_EXISTING_DRAFT",
          draftReplyId: created.id,
          budgetOverride: budgetOverride ? { enabled: true, reason: budgetOverrideReason } : { enabled: false },
        },
        dedupKey: `draft:${created.id}:request:${requestId}`,
        triggeredByRequestId: requestId,
        triggeredByUserId: session.user.id,
      })

      await prisma.auditLog.create({
        data: {
          orgId: session.orgId,
          actorUserId: session.user.id,
          action: "DRAFT_VERIFY_REQUESTED",
          entityType: "DraftReply",
          entityId: created.id,
          metadataJson: {
            jobId: verifyJob.id,
            budgetOverride: budgetOverride ? { enabled: true, reason: budgetOverrideReason } : { enabled: false },
          } as never,
        },
      })

      const worker = await runProcessReviewFastPath({
        jobId: verifyJob.id,
        orgId: session.orgId,
        workerId: `fastpath:${requestId}`,
        budgetMs: 2000,
      })

      return {
        body: {
          draftReplyId: created.id,
          verifyJobId: verifyJob.id,
          worker,
        },
      }
    }
  )
}
