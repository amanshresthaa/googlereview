"use client"

import * as React from "react"

import { EmptyState } from "@/components/ErrorStates"
import { ReviewCard } from "@/components/ReviewCard"
import { Inbox, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SkeletonList } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { INBOX_THEME_CLASSES } from "@/lib/design-system/inbox-theme"
import { useSmoothLoading } from "@/lib/hooks/useSmoothLoading"

import type { ReviewRow } from "@/lib/hooks"

type InboxReviewListProps = {
  activeTab: "pending" | "replied" | "all"
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
  onGenerateDraft: (reviewId: string) => Promise<void>
  onSaveDraft: (reviewId: string, text: string, options?: { silent?: boolean }) => Promise<void>
  onVerifyDraft: (reviewId: string) => Promise<void>
  onPublishReply: (reviewId: string, text: string, row: ReviewRow) => Promise<void>
  onLoadMore: () => void
  onRetry: () => void
}

const NOOP_CHECKED_CHANGE: (reviewId: string, checked: boolean) => void = () => {}

export const InboxReviewList = React.memo(function InboxReviewList({
  activeTab,
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
  onGenerateDraft,
  onSaveDraft,
  onVerifyDraft,
  onPublishReply,
  onLoadMore,
  onRetry,
}: InboxReviewListProps) {
  const showLoading = useSmoothLoading(loading && rows.length === 0, { delayMs: 120, minDurationMs: 420 })
  const hasRows = !showLoading && !error && rows.length > 0

  return (
    <section
      id="inbox-review-list-panel"
      role="tabpanel"
      aria-labelledby={`inbox-tab-${activeTab}`}
      aria-busy={showLoading || loadingMore}
      className={INBOX_THEME_CLASSES.feedListSection}
    >
      <ScrollArea className="h-full">
        <div className={INBOX_THEME_CLASSES.feedListInner} role="list" aria-label="Reviews list">
          <p className="sr-only" role="status" aria-live="polite">
            {showLoading ? "Loading reviews." : `${rows.length} reviews loaded.`}
          </p>

          {showLoading ? <SkeletonList count={4} /> : null}

          {!showLoading && error ? (
            <EmptyState
              title="Unable to load reviews"
              description={error}
              action={{ label: "Retry", onClick: onRetry }}
            />
          ) : null}

          {!showLoading && !error && rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 opacity-30 text-center">
              <Inbox className="mb-4 h-12 w-12 text-shell-foreground/40" />
              <p className="text-sm font-medium text-shell-foreground/60">All reviews handled</p>
              <p className="mt-1 text-xs text-shell-foreground/30">No conversations match the current queue and filters.</p>
              <Button
                type="button"
                variant="ghost"
                onClick={onRetry}
                className="mt-4 text-shell-foreground/40 hover:text-shell-foreground/60"
              >
                Refresh
              </Button>
            </div>
          ) : null}

          {hasRows
            ? rows.map((row) => (
                <div key={row.id} role="listitem">
                  <ReviewCard
                    reviewId={row.id}
                    row={row}
                    showCheckbox={false}
                    checked={false}
                    onCheckedChange={NOOP_CHECKED_CHANGE}
                    onOpen={onOpenReview}
                    selected={row.id === activeReviewId}
                    showQuickApprove={showQuickApprove}
                    onQuickApprove={onQuickApprove}
                    quickApproveLoading={quickApproveLoadingId === row.id}
                    onGenerateDraft={onGenerateDraft}
                    onSaveDraft={onSaveDraft}
                    onVerifyDraft={onVerifyDraft}
                    onPublishReply={onPublishReply}
                  />
                </div>
              ))
            : null}

          {!showLoading && !error && hasMore ? (
            <div className="pt-2">
              <Button
                type="button"
                variant="ghost"
                className={INBOX_THEME_CLASSES.listLoadMoreButton}
                onClick={onLoadMore}
                disabled={loadingMore}
                aria-label={loadingMore ? "Loading more reviews" : "Load more reviews"}
              >
                {loadingMore ? (
                  <>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin text-shell-foreground/60" />
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
})

InboxReviewList.displayName = "InboxReviewList"
