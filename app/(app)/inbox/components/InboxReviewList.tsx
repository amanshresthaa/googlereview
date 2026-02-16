"use client"

import { AnimatePresence, motion } from "framer-motion"

import { EmptyState } from "@/components/ErrorStates"
import { ReviewCard } from "@/components/ReviewCard"
import { Inbox, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SkeletonList } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { INBOX_THEME_CLASSES } from "@/lib/design-system/inbox-theme"

import type { ReviewRow } from "@/lib/hooks"

type InboxReviewListProps = {
  rows: ReviewRow[]
  activeReviewId: string | null
  loading: boolean
  error: string | null
  hasMore: boolean
  loadingMore: boolean
  showQuickApprove: boolean
  quickApproveLoadingId: string | null
  onOpenReview: (reviewId: string) => void
  onQuickApprove: (reviewId: string) => void
  onLoadMore: () => void
  onRetry: () => void
}

const ICON_STROKE = 2.6

export function InboxReviewList({
  rows,
  activeReviewId,
  loading,
  error,
  hasMore,
  loadingMore,
  showQuickApprove,
  quickApproveLoadingId,
  onOpenReview,
  onQuickApprove,
  onLoadMore,
  onRetry,
}: InboxReviewListProps) {
  const showLoading = loading && rows.length === 0

  return (
    <section className={INBOX_THEME_CLASSES.feedListSection}>
      <ScrollArea className="h-full">
        <div className={INBOX_THEME_CLASSES.feedListInner}>
          {showLoading ? <SkeletonList count={4} /> : null}

          {!showLoading && error ? (
            <EmptyState
              title="Unable to load reviews"
              description={error}
              action={{ label: "Retry", onClick: onRetry }}
            />
          ) : null}

          {!showLoading && !error && rows.length === 0 ? (
              <EmptyState
              icon={Inbox}
              title="All caught up"
              description="No conversations match the current queue and filters."
              action={{ label: "Refresh", onClick: onRetry }}
            />
          ) : null}

          <AnimatePresence initial={false}>
            {!showLoading && !error
              ? rows.map((row, index) => (
                  <motion.div
                    key={row.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{
                      delay: Math.min(index, 8) * 0.025,
                      duration: 0.24,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  >
                    <ReviewCard
                      reviewId={row.id}
                      row={row}
                      showCheckbox={false}
                      checked={false}
                      onCheckedChange={() => {}}
                      onOpen={onOpenReview}
                      selected={row.id === activeReviewId}
                      showQuickApprove={showQuickApprove}
                      onQuickApprove={onQuickApprove}
                      quickApproveLoading={quickApproveLoadingId === row.id}
                    />
                  </motion.div>
                ))
              : null}
          </AnimatePresence>

          {!showLoading && !error && hasMore ? (
            <div className="pt-1">
              <Button
                type="button"
                variant="ghost"
                className="h-10 w-full rounded-full border border-white/60 bg-white/55 text-[11px] font-black uppercase tracking-[0.14em] text-slate-600 transition-all duration-300 hover:bg-white"
                onClick={onLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" strokeWidth={ICON_STROKE} />
                    Loading
                  </>
                ) : (
                  "Load more"
                )}
              </Button>
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </section>
  )
}
