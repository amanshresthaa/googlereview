"use client"

import * as React from "react"
import { Roboto, Roboto_Mono } from "next/font/google"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { BlitzQuickReply } from "./components/BlitzQuickReply"
import { DetailPanel } from "./components/DetailPanel"
import { EmptyState } from "./components/EmptyState"
import { InboxFiltersSheet } from "./components/InboxFiltersSheet"
import { InboxHeader } from "./components/InboxHeader"
import { InboxReviewList } from "./components/InboxReviewList"
import { useDebouncedValue } from "./hooks/useDebouncedValue"
import { useReviewMutations } from "./hooks/useReviewMutations"
import { canBulkApprove, parseFilter, resolveRemoteFilter } from "./model"
import { apiCall } from "./network"
import type { InboxBootstrap, ReviewMutationResponse } from "./types"
import { useIsDesktop } from "@/lib/hooks/useMediaQuery"
import { usePaginatedReviews, type ReviewFilter } from "@/lib/hooks"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { CheckCircle2, MessageSquare, RefreshCw } from "@/components/icons"

const inboxSansFont = Roboto({
  subsets: ["latin"],
  variable: "--font-inbox-sans",
  weight: ["400", "500", "700"],
})

const inboxMonoFont = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-inbox-mono",
  weight: ["500"],
})

const QUEUE_FILTER_OPTIONS: Array<{ value: ReviewFilter; label: string }> = [
  { value: "unanswered", label: "Pending" },
  { value: "urgent", label: "Urgent" },
  { value: "five_star", label: "5 Star" },
  { value: "mentions", label: "Mentions" },
  { value: "all", label: "All" },
]

function parseInitialTab(input: string | null, fallback: "all" | "pending" | "replied") {
  if (input === "all" || input === "pending" || input === "replied") return input
  return fallback
}

function parseInitialRating(input: string | null) {
  if (!input) return "all"
  const num = Number(input)
  if (!Number.isFinite(num) || num < 1 || num > 5) return "all"
  return String(Math.floor(num))
}

type InboxClientProps = {
  ssrBootstrap: InboxBootstrap | null
}

export default function InboxClient({ ssrBootstrap }: InboxClientProps) {
  const searchParams = useSearchParams()
  const initialFilter = parseFilter(searchParams.get("filter"))
  const initialMention = searchParams.get("mention")?.trim().toLowerCase() ?? ""
  const derivedInitialTab = initialFilter === "all" ? "all" : "pending"
  const initialTab = parseInitialTab(searchParams.get("tab"), derivedInitialTab)
  const initialLocationId = searchParams.get("locationId")?.trim() ?? ""
  const initialRating = parseInitialRating(searchParams.get("rating"))
  const initialEffectiveFilter =
    initialFilter === "mentions" && initialMention.length === 0 ? "all" : initialFilter
  const initialRemoteFilter = resolveRemoteFilter(initialEffectiveFilter, initialTab)
  const initialRemoteStatus =
    initialTab === "pending" ? "pending" : initialTab === "replied" ? "replied" : "all"
  const initialRemoteMention = initialEffectiveFilter === "mentions" ? initialMention || undefined : undefined

  const [bootstrap, setBootstrap] = React.useState<InboxBootstrap | null>(ssrBootstrap)
  const [bootstrapLoading, setBootstrapLoading] = React.useState(ssrBootstrap === null)

  const [baseFilter, setBaseFilter] = React.useState<ReviewFilter>(initialFilter)
  const [mentionFilter, setMentionFilter] = React.useState(initialMention)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [locationFilter, setLocationFilter] = React.useState(initialLocationId || "all")
  const [ratingFilter, setRatingFilter] = React.useState(initialRating)
  const [activeTab, setActiveTab] = React.useState<"all" | "pending" | "replied">(initialTab)
  const [activeReviewId, setActiveReviewId] = React.useState<string | null>(null)

  const [showBlitzSheet, setShowBlitzSheet] = React.useState(false)
  const [showDetailSheet, setShowDetailSheet] = React.useState(false)
  const [showFilterSheet, setShowFilterSheet] = React.useState(false)

  const [selectionMode, setSelectionMode] = React.useState(false)
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [quickApproveLoadingId, setQuickApproveLoadingId] = React.useState<string | null>(null)
  const [bulkActionLoading, setBulkActionLoading] = React.useState(false)

  const isDesktop = useIsDesktop()
  const debouncedSearch = useDebouncedValue(searchQuery, 320)
  const filterSheetSide: "right" | "bottom" = isDesktop ? "right" : "bottom"

  React.useEffect(() => {
    if (ssrBootstrap !== null) return

    setBootstrapLoading(true)
    void (async () => {
      try {
        const params = new URLSearchParams({
          filter: initialRemoteFilter,
          status: initialRemoteStatus,
          includeCounts: "0",
        })
        if (initialRemoteMention) params.set("mention", initialRemoteMention)
        if (initialLocationId) params.set("locationId", initialLocationId)
        if (initialRating !== "all") params.set("rating", initialRating)

        const data = await apiCall<InboxBootstrap>(`/api/inbox/bootstrap?${params.toString()}`, "GET")
        setBootstrap(data)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load inbox settings")
      } finally {
        setBootstrapLoading(false)
      }
    })()
  }, [ssrBootstrap, initialLocationId, initialRating, initialRemoteFilter, initialRemoteMention, initialRemoteStatus])

  React.useEffect(() => {
    if (isDesktop) {
      setShowDetailSheet(false)
    }
  }, [isDesktop])

  React.useEffect(() => {
    if (!selectionMode) {
      setSelectedIds([])
    }
  }, [selectionMode])

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
    if (mentionFilter.trim()) return
    if (mentionKeywords.length === 0) return
    setMentionFilter(mentionKeywords[0])
  }, [mentionFilter, mentionKeywords])

  React.useEffect(() => {
    if (baseFilter === "mentions" && mentionKeywords.length === 0) {
      setBaseFilter("unanswered")
    }
  }, [baseFilter, mentionKeywords.length])

  const mentionSelection = mentionFilter.trim().toLowerCase()
  const effectiveBaseFilter = baseFilter === "mentions" && mentionSelection.length === 0 ? "all" : baseFilter
  const remoteFilter = resolveRemoteFilter(effectiveBaseFilter, activeTab)
  const remoteStatus = activeTab === "pending" ? "pending" : activeTab === "replied" ? "replied" : "all"

  const normalizedMention = effectiveBaseFilter === "mentions" ? mentionSelection || undefined : undefined
  const normalizedSearch = debouncedSearch.trim() || undefined
  const normalizedLocation = locationFilter === "all" ? undefined : locationFilter
  const normalizedRating = ratingFilter === "all" ? undefined : Number(ratingFilter)

  const { rows, counts, loading, loadingMore, error, hasMore, loadMore, refresh, updateRow } = usePaginatedReviews({
    filter: remoteFilter,
    mention: normalizedMention,
    status: remoteStatus,
    search: normalizedSearch,
    locationId: normalizedLocation,
    rating: Number.isFinite(normalizedRating) ? normalizedRating : undefined,
    enabled: !bootstrapLoading,
    initialPage: bootstrap?.initialPage ?? null,
  })

  const { generateDraft, saveDraft, verifyDraft, publishReply } = useReviewMutations({
    rows,
    updateRow,
    refresh,
  })

  React.useEffect(() => {
    if (!error) return
    if (error === "mention is required when filter=mentions.") {
      toast.error("Pick a keyword before using the mentions queue.")
      return
    }
    toast.error(error === "SESSION_EXPIRED" ? "Session expired. Please sign in again." : error)
  }, [error])

  React.useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => rows.some((row) => row.id === id)))
  }, [rows])

  React.useEffect(() => {
    if (activeReviewId && !rows.some((row) => row.id === activeReviewId)) {
      setActiveReviewId(null)
      setShowDetailSheet(false)
    }
  }, [rows, activeReviewId])

  React.useEffect(() => {
    if (!activeReviewId && rows.length > 0 && !loading) {
      setActiveReviewId(rows[0].id)
    }
  }, [activeReviewId, rows, loading])

  const activeRow = React.useMemo(() => rows.find((row) => row.id === activeReviewId) ?? null, [rows, activeReviewId])
  const pendingRows = React.useMemo(() => rows.filter((row) => row.status === "pending"), [rows])
  const eligibleBulkIds = React.useMemo(
    () => rows.filter((row) => canBulkApprove(row)).map((row) => row.id),
    [rows],
  )

  const pendingCount = counts?.unanswered ?? rows.filter((row) => row.status === "pending").length

  const activeFiltersCount =
    (searchQuery ? 1 : 0) +
    (locationFilter !== "all" ? 1 : 0) +
    (ratingFilter !== "all" ? 1 : 0) +
    (baseFilter !== "unanswered" ? 1 : 0)

  const applyFilter = React.useCallback(
    (next: ReviewFilter) => {
      setBaseFilter(next)

      if ((next === "unanswered" || next === "urgent") && activeTab === "replied") {
        setActiveTab("pending")
      }

      if (next === "mentions" && !mentionFilter.trim() && mentionKeywords.length > 0) {
        setMentionFilter(mentionKeywords[0])
      }
    },
    [activeTab, mentionFilter, mentionKeywords],
  )

  const clearAllFilters = React.useCallback(() => {
    setSearchQuery("")
    setLocationFilter("all")
    setRatingFilter("all")
    setBaseFilter("unanswered")
    if (mentionKeywords.length > 0) {
      setMentionFilter(mentionKeywords[0])
    }
  }, [mentionKeywords])

  const openBlitzQuickReply = React.useCallback((fromEvent = false) => {
    setActiveTab("pending")
    setBaseFilter("all")
    setSearchQuery("")
    setLocationFilter("all")
    setRatingFilter("all")
    setSelectionMode(false)
    setShowFilterSheet(false)
    setShowDetailSheet(false)
    setShowBlitzSheet(true)

    if (fromEvent) {
      toast.success("Quick Reply opened")
    }
  }, [])

  React.useEffect(() => {
    const handler = () => openBlitzQuickReply(true)
    window.addEventListener("replyai:open-blitz", handler)
    return () => window.removeEventListener("replyai:open-blitz", handler)
  }, [openBlitzQuickReply])

  const toggleSelectionById = React.useCallback((reviewId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(reviewId) ? prev : [...prev, reviewId]
      return prev.filter((id) => id !== reviewId)
    })
  }, [])

  const handleOpenReview = React.useCallback(
    (reviewId: string) => {
      setActiveReviewId(reviewId)
      if (!isDesktop) {
        setShowDetailSheet(true)
      }
    },
    [isDesktop],
  )

  const handleQuickApprove = React.useCallback(
    async (reviewId: string) => {
      const row = rows.find((item) => item.id === reviewId)
      if (!row?.currentDraft?.text?.trim()) return

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
      toast.error("Bulk approve is disabled in settings.")
      return
    }

    const eligibleIds = selectedIds.filter((id) => {
      const row = rows.find((item) => item.id === id)
      return row ? canBulkApprove(row) : false
    })

    if (eligibleIds.length === 0) {
      toast.error("Select 5-star pending reviews with verified drafts.")
      return
    }

    setBulkActionLoading(true)
    try {
      await apiCall<ReviewMutationResponse>("/api/replies/bulk-approve", "POST", {
        reviewIds: eligibleIds.slice(0, 50),
      })
      toast.success(`${eligibleIds.length} replies published`)
      setSelectedIds([])
      setSelectionMode(false)
      void refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk approve failed")
    } finally {
      setBulkActionLoading(false)
    }
  }, [bootstrap?.bulkApproveEnabled, refresh, rows, selectedIds])

  const detailContent = activeRow ? (
    <DetailPanel
      row={activeRow}
      onGenerate={generateDraft}
      onSave={saveDraft}
      onVerify={verifyDraft}
      onPublish={publishReply}
    />
  ) : (
    <EmptyState
      icon={MessageSquare}
      title="Nothing selected"
      description="Choose a review from the list to see details and reply tools."
    />
  )

  const locations = bootstrap?.locations ?? []
  const queueOptions = React.useMemo(
    () =>
      QUEUE_FILTER_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
        disabled: option.value === "mentions" && mentionKeywords.length === 0,
      })),
    [mentionKeywords.length],
  )

  return (
    <div
      className={cn(
        inboxSansFont.variable,
        inboxMonoFont.variable,
        "flex h-full w-full flex-col overflow-hidden bg-background text-foreground [font-family:var(--font-inbox-sans)]",
      )}
    >
      <InboxHeader
        pendingCount={pendingCount}
        loading={loading}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        activeTab={activeTab}
        onActiveTabChange={setActiveTab}
        activeFiltersCount={activeFiltersCount}
        onOpenFilters={() => setShowFilterSheet(true)}
        onOpenQuickReply={() => openBlitzQuickReply(false)}
        quickReplyDisabled={pendingRows.length === 0}
        bulkApproveEnabled={Boolean(bootstrap?.bulkApproveEnabled)}
        selectionMode={selectionMode}
        onToggleSelectionMode={() => setSelectionMode((prev) => !prev)}
        eligibleBulkCount={eligibleBulkIds.length}
        onSelectReady={() => setSelectedIds(eligibleBulkIds)}
        onRefresh={() => void refresh()}
      />

      <div className="flex-1 overflow-hidden md:grid md:grid-cols-[380px_minmax(0,1fr)] lg:grid-cols-[420px_minmax(0,1fr)]">
        <InboxReviewList
          loading={loading}
          bootstrapLoading={bootstrapLoading}
          rows={rows}
          activeReviewId={activeReviewId}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          quickApproveLoadingId={quickApproveLoadingId}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onOpenReview={handleOpenReview}
          onCheckedChange={toggleSelectionById}
          onQuickApprove={handleQuickApprove}
          onLoadMore={loadMore}
        />

        <aside className="hidden h-full overflow-hidden md:flex md:flex-col">{detailContent}</aside>
      </div>

      {selectionMode && selectedIds.length > 0 ? (
        <div className="fixed inset-x-3 bottom-3 z-40 rounded-xl border bg-background p-3 shadow-lg md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:rounded-full md:px-5 md:py-3">
          <div className="flex flex-wrap items-center justify-between gap-2 md:gap-3">
            <Badge className="rounded-full px-2.5 py-1">{selectedIds.length} selected</Badge>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" onClick={handleBulkApprove} disabled={bulkActionLoading}>
                {bulkActionLoading ? (
                  <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                )}
                Approve & publish
              </Button>

              <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
                Clear
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Sheet open={showBlitzSheet} onOpenChange={setShowBlitzSheet}>
        <SheetContent side="right" className="h-screen w-screen max-w-none p-0 sm:max-w-none">
          <SheetTitle className="sr-only">Quick Reply Blitz Mode</SheetTitle>
          <BlitzQuickReply
            pendingRows={pendingRows}
            focusReviewId={activeReviewId}
            onGenerate={generateDraft}
            onSave={saveDraft}
            onPublish={publishReply}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={showDetailSheet} onOpenChange={setShowDetailSheet}>
        <SheetContent side="right" className="w-full max-w-none p-0 md:hidden">
          <SheetTitle className="sr-only">Review details</SheetTitle>
          {detailContent}
        </SheetContent>
      </Sheet>

      <InboxFiltersSheet
        open={showFilterSheet}
        onOpenChange={setShowFilterSheet}
        side={filterSheetSide}
        queueOptions={queueOptions}
        baseFilter={baseFilter}
        onBaseFilterChange={applyFilter}
        locationFilter={locationFilter}
        onLocationFilterChange={setLocationFilter}
        locations={locations}
        ratingFilter={ratingFilter}
        onRatingFilterChange={setRatingFilter}
        showMentionFilter={effectiveBaseFilter === "mentions" && mentionKeywords.length > 0}
        mentionFilter={mentionFilter}
        onMentionFilterChange={setMentionFilter}
        mentionKeywords={mentionKeywords}
        onClearAll={clearAllFilters}
      />
    </div>
  )
}
