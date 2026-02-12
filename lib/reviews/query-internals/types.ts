import type { ReviewsFilter, ReviewsStatus } from "@/lib/reviews/listing"

export type ListReviewsPageInput = {
  orgId: string
  filter: ReviewsFilter
  mention?: string
  status?: ReviewsStatus
  locationId?: string
  rating?: number
  search?: string
  limit: number
  cursor?: string
  includeCounts?: boolean
}

export type ReviewListQueryTiming = {
  includeCounts: boolean
  listMs: number
  countsMs: number
  countsCacheHit: boolean
  totalMs: number
}

export type ReviewCountsQueryTiming = {
  countsMs: number
  cacheHit: boolean
}

export type ReviewsCursor = {
  t: string
  id: string
}
