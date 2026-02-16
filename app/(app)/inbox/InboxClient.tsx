"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { ErrorBoundary, ErrorState } from "@/components/ErrorStates"
import { NotificationProvider, useNotifications } from "@/components/NotificationCenter"
import { usePaginatedReviews, useReviewDetail, type ReviewFilter, type ReviewRow } from "@/lib/hooks"
import { useIsDesktop } from "@/lib/hooks/useMediaQuery"
import { cn } from "@/lib/utils"
import { INBOX_THEME_CLASSES } from "@/lib/design-system/inbox-theme"

import { InboxDetailPanel } from "./components/InboxDetailPanel"
import { InboxFilterBar } from "./components/InboxFilterBar"
import { InboxHeader, type InboxTab } from "./components/InboxHeader"
import { InboxReviewList } from "./components/InboxReviewList"
import { useReviewMutations } from "./hooks/useReviewMutations"
import { canBulkApprove, parseFilter, resolveRemoteFilter } from "./model"
import { apiCall } from "./network"

import type { InboxBootstrap } from "./types"

type BulkApproveResponse = {
  acceptedCount?: number
  jobIds?: string[]
}

type InboxClientProps = {
  ssrBootstrap: InboxBootstrap | null
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value)

  React.useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebounced(value)
    }, delayMs)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [delayMs, value])

  return debounced
}

function parseInitialTab(input: string | null, fallback: InboxTab): InboxTab {
  if (input === "pending" || input === "replied" || input === "all") return input
  return fallback
}

function parseInitialRating(input: string | null): string {
  if (!input) return "all"
  const numeric = Number(input)
  if (!Number.isFinite(numeric) || numeric < 1 || numeric > 5) return "all"
  return String(Math.floor(numeric))
}

function InboxErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorState
      error={error}
      title="Inbox failed to render"
      description="A runtime error occurred while loading this page."
      onRetry={reset}
    />
  )
}

export default function InboxClient({ ssrBootstrap }: InboxClientProps) {
  return (
    <ErrorBoundary fallback={InboxErrorFallback}>
      <NotificationProvider>
        <InboxClientBody ssrBootstrap={ssrBootstrap} />
      </NotificationProvider>
    </ErrorBoundary>
  )
}

function InboxClientBody({ ssrBootstrap }: InboxClientProps) {
  const searchParams = useSearchParams()
  const isDesktop = useIsDesktop()
  const { addNotification } = useNotifications()

  const initialParams = React.useMemo(() => {
    const filter = parseFilter(searchParams.get("filter"))
    const tabFallback: InboxTab = filter === "all" ? "all" : "pending"
    const tab = parseInitialTab(searchParams.get("tab"), tabFallback)

    return {
      filter,
      tab,
      mention: searchParams.get("mention")?.trim().toLowerCase() ?? "",
      locationId: searchParams.get("locationId")?.trim() ?? "",
      rating: parseInitialRating(searchParams.get("rating")),
    }
  }, [searchParams])

  const [bootstrap, setBootstrap] = React.useState<InboxBootstrap | null>(ssrBootstrap)
  const [bootstrapLoading, setBootstrapLoading] = React.useState(ssrBootstrap === null)

  const [baseFilter, setBaseFilter] = React.useState<ReviewFilter>(initialParams.filter)
  const [activeTab, setActiveTab] = React.useState<InboxTab>(initialParams.tab)
  const [mentionFilter, setMentionFilter] = React.useState(initialParams.mention)
  const [locationFilter, setLocationFilter] = React.useState(initialParams.locationId || "all")
  const [ratingFilter, setRatingFilter] = React.useState(initialParams.rating)
  const [search, setSearch] = React.useState("")
  const [activeReviewId, setActiveReviewId] = React.useState<string | null>(null)
  const [quickApproveLoadingId, setQuickApproveLoadingId] = React.useState<string | null>(null)
  const [bulkApproveLoading, setBulkApproveLoading] = React.useState(false)

  const debouncedSearch = useDebouncedValue(search, 300)

  React.useEffect(() => {
    if (ssrBootstrap !== null) return

    setBootstrapLoading(true)

    void (async () => {
      try {
        const params = new URLSearchParams({
          filter: resolveRemoteFilter(initialParams.filter, initialParams.tab),
          status: initialParams.tab,
          includeCounts: "1",
        })

        if (initialParams.filter === "mentions" && initialParams.mention) {
          params.set("mention", initialParams.mention)
        }
        if (initialParams.locationId) {
          params.set("locationId", initialParams.locationId)
        }
        if (initialParams.rating !== "all") {
          params.set("rating", initialParams.rating)
        }

        const nextBootstrap = await apiCall<InboxBootstrap>(`/api/inbox/bootstrap?${params.toString()}`, "GET")
        setBootstrap(nextBootstrap)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load inbox bootstrap")
      } finally {
        setBootstrapLoading(false)
      }
    })()
  }, [initialParams, ssrBootstrap])

  const mentionKeywords = React.useMemo(() => {
    return Array.from(
      new Set(
        (bootstrap?.mentionKeywords ?? [])
          .map((keyword) => keyword.trim().toLowerCase())
          .filter(Boolean),
      ),
    )
  }, [bootstrap?.mentionKeywords])

  React.useEffect(() => {
    if (mentionFilter.trim() || mentionKeywords.length === 0) return
    setMentionFilter(mentionKeywords[0])
  }, [mentionFilter, mentionKeywords])

  React.useEffect(() => {
    if (baseFilter !== "mentions") return
    if (mentionKeywords.length > 0) return
    setBaseFilter("unanswered")
  }, [baseFilter, mentionKeywords.length])

  const normalizedMention = mentionFilter.trim().toLowerCase()
  const effectiveFilter = baseFilter === "mentions" && normalizedMention.length === 0 ? "all" : baseFilter
  const remoteFilter = resolveRemoteFilter(effectiveFilter, activeTab)
  const remoteStatus = activeTab

  const queryMention = effectiveFilter === "mentions" ? normalizedMention || undefined : undefined
  const querySearch = debouncedSearch.trim() || undefined
  const queryLocation = locationFilter === "all" ? undefined : locationFilter
  const queryRating = ratingFilter === "all" ? undefined : Number(ratingFilter)

  const { rows, counts, loading, loadingMore, error, hasMore, loadMore, refresh, updateRow } = usePaginatedReviews({
    filter: remoteFilter,
    status: remoteStatus,
    mention: queryMention,
    search: querySearch,
    locationId: queryLocation,
    rating: Number.isFinite(queryRating) ? queryRating : undefined,
    enabled: !bootstrapLoading,
    initialPage: bootstrap?.initialPage ?? null,
  })

  const { review: activeDetail, loading: detailLoading, error: detailError, refresh: refreshDetail } = useReviewDetail(activeReviewId)

  const handleQueuedJob = React.useCallback(
    (event: { jobId: string; reviewId: string; operation: "generate" | "verify" | "publish" }) => {
      const title =
        event.operation === "generate"
          ? "Draft generation queued"
          : event.operation === "verify"
            ? "Verification queued"
            : "Reply publish queued"

      addNotification({
        type: "loading",
        title,
        message: "Tracking background job in real time.",
        jobId: event.jobId,
        action: {
          label: "Open review",
          onClick: () => {
            setActiveReviewId(event.reviewId)
          },
        },
      })
    },
    [addNotification],
  )

  const { generateDraft, saveDraft, verifyDraft, publishReply } = useReviewMutations({
    rows,
    updateRow,
    refresh,
    onQueuedJob: handleQueuedJob,
  })

  const handleGenerate = React.useCallback(async (reviewId: string) => {
    await generateDraft(reviewId)
    if (reviewId === activeReviewId) refreshDetail()
  }, [activeReviewId, generateDraft, refreshDetail])

  const handleSave = React.useCallback(async (reviewId: string, text: string, options?: { silent?: boolean }) => {
    await saveDraft(reviewId, text, options)
    if (reviewId === activeReviewId) refreshDetail()
  }, [activeReviewId, refreshDetail, saveDraft])

  const handleVerify = React.useCallback(async (reviewId: string) => {
    await verifyDraft(reviewId)
    if (reviewId === activeReviewId) refreshDetail()
  }, [activeReviewId, refreshDetail, verifyDraft])

  const handlePublish = React.useCallback(async (reviewId: string, text: string, row: ReviewRow) => {
    await publishReply(reviewId, text, row)
    if (reviewId === activeReviewId) refreshDetail()
  }, [activeReviewId, publishReply, refreshDetail])

  React.useEffect(() => {
    if (!error) return
    if (error === "mention is required when filter=mentions.") {
      toast.error("Pick a mention keyword before using the mentions queue.")
      return
    }
    toast.error(error === "SESSION_EXPIRED" ? "Session expired. Please sign in again." : error)
  }, [error])

  React.useEffect(() => {
    if (!activeReviewId) return
    if (!rows.some((row) => row.id === activeReviewId)) {
      setActiveReviewId(null)
    }
  }, [activeReviewId, rows])

  React.useEffect(() => {
    if (!isDesktop) return
    if (activeReviewId || rows.length === 0 || loading) return
    setActiveReviewId(rows[0].id)
  }, [activeReviewId, isDesktop, loading, rows])

  const activeRow = React.useMemo(() => rows.find((row) => row.id === activeReviewId) ?? null, [rows, activeReviewId])
  const pendingCount = counts?.unanswered ?? rows.filter((row) => row.status === "pending").length
  const eligibleBulkRows = React.useMemo(() => rows.filter((row) => canBulkApprove(row)), [rows])

  const activeFiltersCount =
    Number(search.trim().length > 0) +
    Number(baseFilter !== "unanswered") +
    Number(locationFilter !== "all") +
    Number(ratingFilter !== "all")

  const clearFilters = React.useCallback(() => {
    setSearch("")
    setBaseFilter("unanswered")
    setLocationFilter("all")
    setRatingFilter("all")
    if (mentionKeywords.length > 0) {
      setMentionFilter(mentionKeywords[0])
    }
  }, [mentionKeywords])

  const openReview = React.useCallback((reviewId: string) => {
    setActiveReviewId(reviewId)
  }, [])

  const handleQuickApprove = React.useCallback(
    async (reviewId: string) => {
      const row = rows.find((item) => item.id === reviewId)
      if (!row?.currentDraft?.text?.trim()) {
        toast.error("No verified draft to publish for this review.")
        return
      }

      setQuickApproveLoadingId(reviewId)
      try {
        await publishReply(reviewId, row.currentDraft.text, row)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Quick approve failed")
      } finally {
        setQuickApproveLoadingId(null)
      }
    },
    [publishReply, rows],
  )

  const handleBulkApprove = React.useCallback(async () => {
    if (!bootstrap?.bulkApproveEnabled) {
      toast.error("Bulk approve is disabled in organization settings.")
      return
    }
    if (eligibleBulkRows.length === 0) {
      toast.error("No eligible 5-star, ready-draft reviews found on this page.")
      return
    }

    setBulkApproveLoading(true)
    try {
      const response = await apiCall<BulkApproveResponse>("/api/replies/bulk-approve", "POST", {
        reviewIds: eligibleBulkRows.slice(0, 50).map((row) => row.id),
      })

      const acceptedCount = response.acceptedCount ?? eligibleBulkRows.length
      toast.success(`${acceptedCount} ${acceptedCount === 1 ? "reply" : "replies"} queued`)

      if (response.jobIds?.[0]) {
        addNotification({
          type: "loading",
          title: "Bulk publishing queued",
          message: `${acceptedCount} replies are processing in the background.`,
          jobId: response.jobIds[0],
        })
      }

      void refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk approve failed")
    } finally {
      setBulkApproveLoading(false)
    }
  }, [addNotification, bootstrap?.bulkApproveEnabled, eligibleBulkRows, refresh])

  const handleFilterChange = React.useCallback(
    (next: ReviewFilter) => {
      if (next === "mentions" && mentionKeywords.length === 0) {
        toast.error("No mention keywords configured yet.")
        return
      }
      if ((next === "unanswered" || next === "urgent") && activeTab === "replied") {
        setActiveTab("pending")
      }
      setBaseFilter(next)
    },
    [activeTab, mentionKeywords.length],
  )

  const showFeedPane = isDesktop || !activeReviewId
  const showDetailPane = isDesktop || Boolean(activeReviewId)

  return (
    <div className={INBOX_THEME_CLASSES.frame}>
      <div className={INBOX_THEME_CLASSES.workspace}>
        <aside
          className={cn(
            `${INBOX_THEME_CLASSES.feedPane} w-full md:w-[390px] lg:w-[430px]`,
            !showFeedPane && "hidden",
          )}
        >
          <div className="flex h-full min-h-0 flex-col">
            <InboxHeader
              pendingCount={pendingCount}
              tab={activeTab}
              onTabChange={setActiveTab}
              search={search}
              onSearchChange={setSearch}
              refreshing={loading || bootstrapLoading}
              onRefresh={() => void refresh()}
            />

            <InboxFilterBar
              filter={baseFilter}
              onFilterChange={handleFilterChange}
              mentionFilter={mentionFilter}
              onMentionFilterChange={setMentionFilter}
              mentionKeywords={mentionKeywords}
              locationFilter={locationFilter}
              onLocationFilterChange={setLocationFilter}
              locations={bootstrap?.locations ?? []}
              ratingFilter={ratingFilter}
              onRatingFilterChange={setRatingFilter}
              activeFiltersCount={activeFiltersCount}
              onReset={clearFilters}
              onBulkApprove={handleBulkApprove}
              bulkApproveCount={eligibleBulkRows.length}
              bulkApproveLoading={bulkApproveLoading}
              bulkApproveEnabled={Boolean(bootstrap?.bulkApproveEnabled)}
            />

            <div className="min-h-0 flex-1">
              <InboxReviewList
                rows={rows}
                activeReviewId={activeReviewId}
                loading={loading || bootstrapLoading}
                error={error}
                hasMore={hasMore}
                loadingMore={loadingMore}
                showQuickApprove
                quickApproveLoadingId={quickApproveLoadingId}
                onOpenReview={openReview}
                onQuickApprove={handleQuickApprove}
                onLoadMore={loadMore}
                onRetry={() => void refresh()}
              />
            </div>
          </div>
        </aside>

        <main className={cn(INBOX_THEME_CLASSES.detailPane, !showDetailPane && "hidden")}>
          <InboxDetailPanel
            row={activeRow}
            detail={activeDetail}
            detailLoading={detailLoading}
            showMobileBack={!isDesktop && Boolean(activeReviewId)}
            onBack={() => setActiveReviewId(null)}
            onGenerate={handleGenerate}
            onSave={handleSave}
            onVerify={handleVerify}
            onPublish={handlePublish}
          />
        </main>
      </div>
    </div>
  )
}
