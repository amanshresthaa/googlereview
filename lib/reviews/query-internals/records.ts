import { Prisma } from "@prisma/client"

import type { ReviewListRow } from "@/lib/reviews/types"

export const reviewListSelect = {
  id: true,
  starRating: true,
  comment: true,
  reviewerDisplayName: true,
  reviewerIsAnonymous: true,
  createTime: true,
  googleReplyComment: true,
  googleReplyUpdateTime: true,
  mentions: true,
  location: {
    select: {
      id: true,
      displayName: true,
    },
  },
  currentDraftReply: {
    select: {
      id: true,
      text: true,
      status: true,
      version: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.ReviewSelect

export type ReviewListRecord = Prisma.ReviewGetPayload<{ select: typeof reviewListSelect }>

export function toReviewListRow(review: ReviewListRecord): ReviewListRow {
  return {
    id: review.id,
    starRating: review.starRating,
    snippet: (review.comment ?? "").slice(0, 120),
    comment: review.comment ?? "",
    reviewer: {
      displayName: review.reviewerDisplayName,
      isAnonymous: review.reviewerIsAnonymous,
    },
    createTimeIso: review.createTime.toISOString(),
    location: { id: review.location.id, displayName: review.location.displayName },
    unanswered: review.googleReplyComment == null,
    status: review.googleReplyComment == null ? "pending" : "replied",
    reply: {
      comment: review.googleReplyComment,
      updateTimeIso: review.googleReplyUpdateTime?.toISOString() ?? null,
    },
    currentDraft: review.currentDraftReply
      ? {
          id: review.currentDraftReply.id,
          text: review.currentDraftReply.text,
          status: review.currentDraftReply.status,
          version: review.currentDraftReply.version,
          updatedAtIso: review.currentDraftReply.updatedAt.toISOString(),
        }
      : null,
    draftStatus: review.currentDraftReply?.status ?? null,
    mentions: review.mentions,
  }
}
