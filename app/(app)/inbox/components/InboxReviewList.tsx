import * as React from "react"

import { EmptyState } from "./EmptyState"
import { ReviewCardItem } from "./ReviewCardItem"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { InboxIcon, RefreshCw, Sparkles } from "@/components/icons"

import type { ReviewRow } from "@/lib/hooks"

type InboxReviewListProps = {
  loading: boolean
  bootstrapLoading: boolean
  rows: ReviewRow[]
  activeReviewId: string | null
  selectionMode: boolean
  selectedIds: string[]
  quickApproveLoadingId: string | null
  hasMore: boolean
  loadingMore: boolean
  onOpenReview: (reviewId: string) => void
  onCheckedChange: (reviewId: string, checked: boolean) => void
  onQuickApprove: (reviewId: string) => void
  onLoadMore: () => void
}

export function InboxReviewList({
  loading,
  bootstrapLoading,
  rows,
  activeReviewId,
  selectionMode,
  selectedIds,
  quickApproveLoadingId,
  hasMore,
  loadingMore,
  onOpenReview,
  onCheckedChange,
  onQuickApprove,
  onLoadMore,
}: InboxReviewListProps) {
  const showInitialLoading = loading && rows.length === 0

  return (
    <section className="h-full overflow-hidden border-r">
      <ScrollArea className="h-full">
        {showInitialLoading || bootstrapLoading ? (
          <EmptyState icon={RefreshCw} title="Loading reviews" description="Fetching your latest inbox data..." />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={InboxIcon}
            title="No reviews found"
            description="Try adjusting your filters or search query to see results."
          />
        ) : (
          <div className="space-y-2 p-3 pb-28 md:p-4 md:pb-6">
            {rows.map((review) => (
              <ReviewCardItem
                key={review.id}
                row={review}
                selected={review.id === activeReviewId && !selectionMode}
                checked={selectedIds.includes(review.id)}
                showCheckbox={selectionMode}
                quickApproveLoading={quickApproveLoadingId === review.id}
                onOpen={onOpenReview}
                onCheckedChange={onCheckedChange}
                onQuickApprove={onQuickApprove}
              />
            ))}

            {hasMore ? (
              <Button type="button" variant="outline" className="w-full" onClick={onLoadMore} disabled={loadingMore}>
                {loadingMore ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Loading more...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Load more reviews
                  </>
                )}
              </Button>
            ) : null}
          </div>
        )}
      </ScrollArea>
    </section>
  )
}
