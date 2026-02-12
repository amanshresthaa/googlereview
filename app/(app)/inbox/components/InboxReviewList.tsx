import * as React from "react"
import { motion } from "framer-motion"

import { EmptyState } from "./EmptyState"
import { ReviewCardItem } from "./ReviewCardItem"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { InboxIcon, RefreshCw } from "@/components/icons"

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
    <section className="h-full overflow-hidden">
      <ScrollArea className="h-full">
        {showInitialLoading || bootstrapLoading ? (
          <EmptyState icon={RefreshCw} title="Loading reviews" description="Fetching your latest inbox data..." />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={InboxIcon}
            title="All caught up!"
            description="No reviews found for the current filters. Try adjusting them or check back later."
          />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col gap-3 p-4 pb-32 md:pb-8"
          >
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

            {hasMore && (
              <Button 
                type="button" 
                variant="outline" 
                className="w-full h-12 rounded-[20px] border-border/50 bg-background shadow-sm hover:bg-muted/50 font-bold transition-all mt-2" 
                onClick={onLoadMore} 
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                    </motion.div>
                    Syncing more...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Load More Reviews
                  </>
                )}
              </Button>
            )}
          </motion.div>
        )}
      </ScrollArea>
    </section>
  )
}


