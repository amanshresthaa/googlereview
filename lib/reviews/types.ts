export type DraftStatus =
  | "NEEDS_APPROVAL"
  | "BLOCKED_BY_VERIFIER"
  | "READY"
  | "POSTED"
  | "POST_FAILED"

export type ReviewListRow = {
  id: string
  starRating: number
  snippet: string
  comment: string
  reviewer: { displayName: string | null; isAnonymous: boolean }
  location: { id: string; displayName: string }
  createTimeIso: string
  unanswered: boolean
  status: "pending" | "replied"
  reply: { comment: string | null; updateTimeIso: string | null }
  currentDraft: {
    id: string
    text: string
    status: DraftStatus
    version: number
    updatedAtIso: string
    verifierResultJson?: unknown | null
  } | null
  draftStatus: DraftStatus | null
  mentions: string[]
}

export type ReviewListCounts = {
  unanswered: number
  urgent: number
  five_star: number
  mentions_total: number
}

export type ReviewListPage = {
  rows: ReviewListRow[]
  nextCursor: string | null
  counts?: ReviewListCounts
}
