import type { DraftStatus } from "@/lib/reviews/types"

export type ReviewFilter = "unanswered" | "urgent" | "five_star" | "mentions" | "all"
export type ReviewStatusFilter = "all" | "pending" | "replied"

export type ReviewCounts = {
  unanswered: number
  urgent: number
  five_star: number
  mentions_total: number
}

export type ReviewRow = {
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

export type ReviewDetail = {
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
    status: DraftStatus
    version: number
    verifierResultJson: unknown | null
    updatedAt: string
  } | null
  drafts: Array<{
    id: string
    text: string
    status: DraftStatus
    version: number
    updatedAt: string
  }>
}
