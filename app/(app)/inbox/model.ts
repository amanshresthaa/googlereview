import type { ReviewDetail, ReviewFilter, ReviewRow } from "@/lib/hooks"
import { mapReviewDetailToRow } from "@/lib/reviews/detail-to-row"
import { getFirstVerifierIssueMessage } from "@/lib/reviews/verifier-result"

export function parseFilter(input: string | null): ReviewFilter {
  const value = (input ?? "").toLowerCase()
  if (value === "unanswered" || value === "urgent" || value === "five_star" || value === "mentions" || value === "all") {
    return value
  }
  return "unanswered"
}

export function resolveRemoteFilter(baseFilter: ReviewFilter, tab: "all" | "pending" | "replied"): ReviewFilter {
  if (tab === "replied") {
    return baseFilter === "unanswered" || baseFilter === "urgent" ? "all" : baseFilter
  }
  if (tab === "all") {
    return baseFilter === "unanswered" ? "all" : baseFilter
  }
  return baseFilter
}

export function canBulkApprove(row: ReviewRow) {
  return row.status === "pending" && row.starRating === 5 && row.draftStatus === "READY"
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? "?"
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : ""
  return (first + last).toUpperCase()
}

export function mapDetailToRow(existing: ReviewRow, detail: ReviewDetail): ReviewRow {
  return mapReviewDetailToRow(detail, existing)
}

export function applyDetailSnapshot(
  reviewId: string,
  detail: ReviewDetail | null | undefined,
  updateRow: (id: string, updater: (row: ReviewRow) => ReviewRow) => void,
) {
  if (!detail) return false
  updateRow(reviewId, (row) => mapDetailToRow(row, detail))
  return true
}

export function getVerifierBlockedMessage(detail: ReviewDetail | null) {
  const firstMessage = getFirstVerifierIssueMessage(detail?.currentDraft?.verifierResultJson ?? null)
  return firstMessage ?? "Draft was blocked by verifier. Please adjust and retry."
}
