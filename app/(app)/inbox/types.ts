import type { ReviewCounts, ReviewDetail, ReviewFilter, ReviewRow, ReviewStatusFilter } from "@/lib/hooks"

export type LocationOption = {
  id: string
  displayName: string
}

export type InboxBootstrap = {
  mentionKeywords: string[]
  bulkApproveEnabled: boolean
  locations: LocationOption[]
  initialPage: {
    rows: ReviewRow[]
    nextCursor: string | null
    counts?: ReviewCounts
    filter: ReviewFilter
    status?: ReviewStatusFilter
    mention?: string | null
  }
}

export type ReviewMutationResponse = {
  jobId?: string
  verifyJobId?: string
  draftReplyId?: string
  job?: { id: string; status: string }
  worker?: { claimed?: number; [key: string]: unknown }
  review?: ReviewDetail | null
}
