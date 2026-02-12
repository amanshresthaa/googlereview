import type { ReviewListCounts, ReviewListRow } from "@/lib/reviews/types"

export type ReviewFilter = "unanswered" | "urgent" | "five_star" | "mentions" | "all"
export type ReviewStatusFilter = "pending" | "replied" | "all"

export type ReviewRow = ReviewListRow
export type ReviewCounts = ReviewListCounts

export type ReviewDetail = {
  id: string
  starRating: number
  comment: string | null
  createTime: string
  updateTime: string
  reviewer: { displayName: string | null; isAnonymous: boolean }
  reply: { comment: string | null; updateTime: string | null }
  location: { id: string; name: string }
  mentions: string[]
  currentDraft: {
    id: string
    text: string
    status: string
    version: number
    verifierResultJson: unknown | null
    updatedAt?: string
  } | null
  drafts: Array<{
    id: string
    text: string
    status: string
    version: number
    updatedAt?: string
  }>
}
