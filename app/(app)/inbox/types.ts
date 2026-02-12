import type { ReviewDetail, ReviewFilter } from "@/lib/hooks"
import type { ReviewListPage } from "@/lib/reviews/types"

export type LocationOption = {
  id: string
  displayName: string
}

export type InboxBootstrap = {
  mentionKeywords: string[]
  bulkApproveEnabled: boolean
  locations: LocationOption[]
  initialPage: (ReviewListPage & {
    filter: ReviewFilter
    status?: "pending" | "replied" | "all"
    mention?: string | null
  }) | null
}

export type ReviewMutationResponse = {
  accepted?: boolean
  jobId?: string
  verifyJobId?: string
  job?: {
    id: string
    status: "PENDING" | "RUNNING" | "RETRYING" | "COMPLETED" | "FAILED"
    lastError?: string | null
  }
  worker?: { claimed?: number }
  review?: ReviewDetail | null
}
