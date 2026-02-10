"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Inbox, Loader2, AlertCircle, CheckSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { JobHealthWidget } from "@/components/JobHealthWidget"
import { InboxFilters } from "@/components/InboxFilters"
import { ReviewRow } from "@/components/ReviewRow"
import { ReviewListSkeleton } from "@/components/ReviewListSkeleton"
import {
  usePaginatedReviews,
  useReviewDetail,
  type ReviewFilter,
  type ReviewRow as ReviewRowType,
} from "@/lib/hooks"

type Props = {
  initialFilter: ReviewFilter
  initialMention: string | null
  mentionKeywords: string[]
  bulkApproveEnabled: boolean
}

export function InboxClient({
  initialFilter,
  initialMention,
  mentionKeywords,
  bulkApproveEnabled,
}: Props) {
  const router = useRouter()
  const [filter, setFilter] = React.useState<ReviewFilter>(initialFilter)
  const [mention, setMention] = React.useState<string | undefined>(
    initialMention ?? undefined
  )
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [checked, setChecked] = React.useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = React.useState(false)
  const listRef = React.useRef<HTMLDivElement>(null)

  const { rows, counts, loading, loadingMore, error, hasMore, loadMore, refresh } =
    usePaginatedReviews({ filter, mention })

  const {
    review: selectedReview,
    loading: detailLoading,
    error: detailError,
    refresh: refreshDetail,
  } = useReviewDetail(selectedId)

  React.useEffect(() => {
    if (error === "SESSION_EXPIRED") {
      router.replace("/signin")
    } else if (error) {
      toast.error(error)
    }
  }, [error, router])

  React.useEffect(() => {
    if (detailError === "SESSION_EXPIRED") {
      router.replace("/signin")
    } else if (detailError) {
      toast.error(detailError)
    }
  }, [detailError, router])

  React.useEffect(() => {
    setChecked(new Set())
    setSelectedId(null)
  }, [filter, mention])

  const handleFilterChange = React.useCallback(
    (f: ReviewFilter, m?: string) => {
      setFilter(f)
      setMention(m)
      const params = new URLSearchParams()
      params.set("filter", f)
      if (m) params.set("mention", m)
      router.replace(`/inbox?${params.toString()}`, { scroll: false })
    },
    [router]
  )

  const showBulk =
    filter === "five_star" && bulkApproveEnabled

  const eligibleIds = React.useMemo(
    () =>
      rows
        .filter(
          (r) => r.unanswered && r.starRating === 5 && r.draftStatus === "READY"
        )
        .map((r) => r.id),
    [rows]
  )

  const handleSelectAll = () => {
    setChecked(new Set(eligibleIds))
  }

  const handleCheck = (id: string, val: boolean) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (val) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const bulkApprove = async () => {
    if (checked.size === 0) return
    setBulkBusy(true)
    try {
      const res = await fetch("/api/replies/bulk-approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reviewIds: Array.from(checked) }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? res.statusText)
      }
      const data = await res.json()
      if (data.results) {
        const failed = data.results.filter(
          (r: { success: boolean }) => !r.success
        )
        if (failed.length > 0) {
          toast.error(`${failed.length} review(s) failed to approve`)
        } else {
          toast.success(`Approved ${checked.size} review(s)`)
        }
      } else {
        toast.success(`Approved ${checked.size} review(s)`)
      }
      setChecked(new Set())
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBulkBusy(false)
    }
  }

  const handleRowSelect = (row: ReviewRowType) => {
    if (window.innerWidth < 1024) {
      router.push(`/reviews/${row.id}`)
    } else {
      setSelectedId(row.id)
    }
  }

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (rows.length === 0) return
      const currentIdx = rows.findIndex((r) => r.id === selectedId)

      if (e.key === "ArrowDown") {
        e.preventDefault()
        const next = Math.min(currentIdx + 1, rows.length - 1)
        setSelectedId(rows[next].id)
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        const next = Math.max(currentIdx - 1, 0)
        setSelectedId(rows[next].id)
      } else if (e.key === "Enter" && selectedId) {
        e.preventDefault()
        if (window.innerWidth < 1024) {
          router.push(`/reviews/${selectedId}`)
        }
      }
    },
    [rows, selectedId, router]
  )

  return (
    <div className="flex h-full">
      {/* List column */}
      <div
        ref={listRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="w-full lg:w-[420px] lg:shrink-0 flex flex-col border-r border-stone-200 bg-white outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-stone-100">
          <h1 className="text-lg font-semibold text-stone-800">Inbox</h1>
          <JobHealthWidget pollMs={15_000} />
        </div>

        {/* Filters */}
        <div className="border-b border-stone-100">
          <InboxFilters
            filter={filter}
            mention={mention ?? null}
            mentionKeywords={mentionKeywords}
            counts={counts}
            onFilterChange={handleFilterChange}
          />
        </div>

        {/* Bulk actions */}
        {showBulk && eligibleIds.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-stone-100 bg-emerald-50/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              className="text-xs text-emerald-700"
            >
              <CheckSquare className="size-3.5 mr-1" />
              Select all eligible
            </Button>
            {checked.size > 0 && (
              <Button
                size="sm"
                onClick={bulkApprove}
                disabled={bulkBusy}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              >
                {bulkBusy && <Loader2 className="size-3.5 mr-1 animate-spin" />}
                Bulk Approve ({checked.size})
              </Button>
            )}
          </div>
        )}

        {/* Review list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <ReviewListSkeleton />
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-stone-400">
              <Inbox className="size-10 mb-3 stroke-1" />
              <p className="text-sm">No reviews match this filter</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col divide-y divide-stone-100">
                {rows.map((row) => (
                  <ReviewRow
                    key={row.id}
                    row={row}
                    isSelected={selectedId === row.id}
                    showCheckbox={
                      showBulk &&
                      row.unanswered &&
                      row.starRating === 5 &&
                      row.draftStatus === "READY"
                    }
                    isChecked={checked.has(row.id)}
                    onSelect={() => handleRowSelect(row)}
                    onCheck={(val) => handleCheck(row.id, val)}
                  />
                ))}
              </div>
              {hasMore && (
                <div className="px-4 py-3">
                  <Button
                    variant="outline"
                    className="w-full text-sm"
                    onClick={loadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <Loader2 className="size-4 mr-2 animate-spin" />
                    ) : null}
                    Load more
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Detail panel — desktop only */}
      <div className="hidden lg:flex flex-1 flex-col bg-stone-50/50">
        {selectedId ? (
          detailLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="size-6 animate-spin text-stone-400" />
            </div>
          ) : detailError ? (
            <div className="flex-1 flex items-center justify-center px-8">
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="size-4" />
                {detailError}
              </div>
            </div>
          ) : selectedReview ? (
            <DetailPlaceholder
              review={selectedReview}
              onRefresh={refreshDetail}
            />
          ) : null
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-stone-400">
            <Inbox className="size-12 mb-3 stroke-1" />
            <p className="text-sm font-medium">
              Select a review to view details
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function DetailPlaceholder({
  review,
  onRefresh,
}: {
  review: {
    id: string
    starRating: number
    comment: string | null
    createTime: string
    reviewer: { displayName: string | null; isAnonymous: boolean }
    reply: { comment: string | null; updateTime: string | null }
    location: { id: string; name: string }
    currentDraft: {
      id: string
      text: string
      status: string
      version: number
    } | null
  }
  onRefresh: () => void
}) {
  const starColor =
    review.starRating <= 2
      ? "text-red-500"
      : review.starRating === 3
        ? "text-amber-500"
        : "text-emerald-600"

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className={`text-lg font-bold ${starColor}`}>
              {"★".repeat(review.starRating)}
              <span className="text-stone-200">
                {"★".repeat(5 - review.starRating)}
              </span>
            </span>
            <span className="text-xs text-stone-400">
              {new Date(review.createTime).toLocaleDateString()}
            </span>
          </div>
          <p className="text-sm font-medium text-stone-700">
            {review.reviewer.isAnonymous
              ? "Anonymous"
              : review.reviewer.displayName ?? "Anonymous"}
          </p>
          <p className="text-xs text-stone-400">{review.location.name}</p>
        </div>

        <div className="rounded-lg bg-white border border-stone-200 p-4">
          <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">
            {review.comment || "No comment provided."}
          </p>
        </div>

        {review.reply.comment && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-4">
            <p className="text-xs font-medium text-emerald-700 mb-1">
              Your reply
            </p>
            <p className="text-sm text-emerald-800 leading-relaxed whitespace-pre-wrap">
              {review.reply.comment}
            </p>
          </div>
        )}

        {review.currentDraft && !review.reply.comment && (
          <div className="rounded-lg bg-stone-50 border border-stone-200 p-4">
            <p className="text-xs font-medium text-stone-500 mb-1">
              Draft reply ({review.currentDraft.status})
            </p>
            <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">
              {review.currentDraft.text}
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="text-xs"
          >
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() =>
              window.open(`/reviews/${review.id}`, "_self")
            }
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Open full view
          </Button>
        </div>
      </div>
    </div>
  )
}
