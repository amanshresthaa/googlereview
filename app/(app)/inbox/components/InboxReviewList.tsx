"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"

import { EmptyState } from "@/components/ErrorStates"
import { ReviewCard } from "@/components/ReviewCard"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SkeletonList } from "@/components/ui/progress"
import { InboxIcon, RefreshCw } from "@/components/icons"
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
              icon={InboxIcon}
              title="All caught up"
              description="No conversations match the current queue and filters."
              action={{ label: "Refresh", onClick: onRetry }}
            />
          ) : null}

          <AnimatePresence mode="popLayout">
            {!showLoading && !error
              ? rows.map((row, index) => (
                  <motion.div
                    key={row.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{
                      delay: Math.min(index, 10) * 0.03,
                      duration: 0.25,
                      ease: "easeOut",
                    }}
                    className="mb-0.5"
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
            <div className="px-2 py-3">
              <Button
                type="button"
                variant="ghost"
                className="h-9 w-full rounded-xl text-xs font-semibold text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
                onClick={onLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Loading…
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
