import type { ReviewDetail, ReviewFilter, ReviewRow } from "@/lib/hooks"

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
  const draftUpdatedAt =
    typeof (detail.currentDraft as { updatedAt?: string } | null)?.updatedAt === "string"
      ? ((detail.currentDraft as { updatedAt?: string }).updatedAt as string)
      : existing.currentDraft?.updatedAtIso ?? new Date().toISOString()

  return {
    ...existing,
    starRating: detail.starRating,
    snippet: (detail.comment ?? "").slice(0, 120),
    comment: detail.comment ?? "",
    reviewer: {
      displayName: detail.reviewer.displayName,
      isAnonymous: detail.reviewer.isAnonymous,
    },
    createTimeIso: detail.createTime,
    location: {
      id: detail.location.id,
      displayName: detail.location.name,
    },
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
          status: detail.currentDraft.status,
          version: detail.currentDraft.version,
          updatedAtIso: draftUpdatedAt,
        }
      : null,
    draftStatus: detail.currentDraft?.status ?? null,
    mentions: detail.mentions,
  }
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
  const violations = (
    (detail?.currentDraft?.verifierResultJson as {
      dspy?: { verifier?: { violations?: Array<{ message?: string }> } }
    } | null)?.dspy?.verifier?.violations ?? []
  )
  const firstMessage = violations.find((item) => typeof item?.message === "string")?.message
  return firstMessage?.trim() || "Draft was blocked by verifier. Please adjust and retry."
}
