import type { ReviewDetail, ReviewRow } from "@/lib/hooks/reviews/types"
import type { DraftStatus } from "@/lib/reviews/types"

const DRAFT_STATUS_VALUES: DraftStatus[] = [
  "NEEDS_APPROVAL",
  "BLOCKED_BY_VERIFIER",
  "READY",
  "POSTED",
  "POST_FAILED",
]

function normalizeDraftStatus(status: string): DraftStatus {
  if (DRAFT_STATUS_VALUES.includes(status as DraftStatus)) {
    return status as DraftStatus
  }
  return "NEEDS_APPROVAL"
}

export function mapReviewDetailToRow(detail: ReviewDetail, existing?: ReviewRow): ReviewRow {
  const draftStatus = detail.currentDraft ? normalizeDraftStatus(detail.currentDraft.status) : null
  const draftUpdatedAt =
    detail.currentDraft == null
      ? null
      : typeof detail.currentDraft.updatedAt === "string" && detail.currentDraft.updatedAt.length > 0
        ? detail.currentDraft.updatedAt
        : existing?.currentDraft?.updatedAtIso ?? detail.updateTime

  return {
    id: detail.id,
    starRating: detail.starRating,
    snippet: (detail.comment ?? "").slice(0, 120),
    comment: detail.comment ?? "",
    reviewer: {
      displayName: detail.reviewer.displayName,
      isAnonymous: detail.reviewer.isAnonymous,
    },
    location: {
      id: detail.location.id,
      displayName: detail.location.name,
    },
    createTimeIso: detail.createTime,
    unanswered: detail.reply.comment == null,
    status: detail.reply.comment == null ? "pending" : "replied",
    reply: {
      comment: detail.reply.comment,
      updateTimeIso: detail.reply.updateTime,
    },
    currentDraft: detail.currentDraft
      ? {
          id: detail.currentDraft.id,
          text: detail.currentDraft.text,
          status: draftStatus ?? "NEEDS_APPROVAL",
          version: detail.currentDraft.version,
          updatedAtIso: draftUpdatedAt ?? detail.updateTime,
          verifierResultJson: detail.currentDraft.verifierResultJson,
        }
      : null,
    draftStatus,
    mentions: detail.mentions,
  }
}
