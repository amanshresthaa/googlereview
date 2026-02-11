import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

const reviewDetailInclude = {
  location: true,
  currentDraftReply: true,
  drafts: { orderBy: { version: "desc" }, take: 10 },
} satisfies Prisma.ReviewInclude

type ReviewWithDetail = Prisma.ReviewGetPayload<{ include: typeof reviewDetailInclude }>

export type ReviewDetailPayload = {
  id: string
  starRating: number
  comment: string | null
  createTime: string
  updateTime: string
  reviewer: {
    displayName: string | null
    isAnonymous: boolean
  }
  reply: {
    comment: string | null
    updateTime: string | null
  }
  location: {
    id: string
    name: string
  }
  mentions: string[]
  currentDraft: {
    id: string
    text: string
    status: string
    version: number
    verifierResultJson: unknown | null
    updatedAt: string
  } | null
  drafts: Array<{
    id: string
    text: string
    status: string
    version: number
    updatedAt: string
  }>
}

export function serializeReviewDetail(review: ReviewWithDetail): ReviewDetailPayload {
  return {
    id: review.id,
    starRating: review.starRating,
    comment: review.comment,
    createTime: review.createTime.toISOString(),
    updateTime: review.updateTime.toISOString(),
    reviewer: {
      displayName: review.reviewerDisplayName,
      isAnonymous: review.reviewerIsAnonymous,
    },
    reply: {
      comment: review.googleReplyComment,
      updateTime: review.googleReplyUpdateTime?.toISOString() ?? null,
    },
    location: { id: review.location.id, name: review.location.displayName },
    mentions: review.mentions,
    currentDraft: review.currentDraftReply
      ? {
          id: review.currentDraftReply.id,
          text: review.currentDraftReply.text,
          status: review.currentDraftReply.status,
          version: review.currentDraftReply.version,
          verifierResultJson: review.currentDraftReply.verifierResultJson,
          updatedAt: review.currentDraftReply.updatedAt.toISOString(),
        }
      : null,
    drafts: review.drafts.map((draft) => ({
      id: draft.id,
      text: draft.text,
      status: draft.status,
      version: draft.version,
      updatedAt: draft.updatedAt.toISOString(),
    })),
  }
}

export async function getReviewDetailForOrg(input: {
  reviewId: string
  orgId: string
}): Promise<ReviewDetailPayload | null> {
  const review = await prisma.review.findFirst({
    where: {
      id: input.reviewId,
      orgId: input.orgId,
      location: { enabled: true },
    },
    include: reviewDetailInclude,
  })

  return review ? serializeReviewDetail(review) : null
}
