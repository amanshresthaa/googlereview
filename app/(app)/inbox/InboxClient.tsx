"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
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
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { CheckCircle2, MessageSquare, RefreshCw, Send, X } from "@/components/icons"

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
          includeCounts: "1",
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
        "flex h-full w-full flex-col overflow-hidden bg-background text-foreground",
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

      <div className="flex-1 overflow-hidden md:grid md:grid-cols-[400px_minmax(0,1fr)] lg:grid-cols-[440px_minmax(0,1fr)] bg-zinc-50/50 dark:bg-zinc-950/20">
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

        <motion.aside
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden h-full overflow-hidden md:flex md:flex-col border-l border-border/50 bg-background/50 backdrop-blur-sm"
        >
          {detailContent}
        </motion.aside>
      </div>

      <AnimatePresence>
        {selectionMode && selectedIds.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 100, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 100, x: "-50%" }}
            className="fixed left-1/2 bottom-8 z-50 min-w-[320px] max-w-[90vw]"
          >
            <div className="rounded-[24px] border border-primary/20 bg-background/80 backdrop-blur-xl p-4 shadow-google-xl flex items-center justify-between gap-6">
              <div className="flex items-center gap-3 pl-2">
                <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-glow-primary">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-black text-foreground tabular-nums">{selectedIds.length} Selected</div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Ready for batch action</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button 
                  type="button" 
                  size="sm" 
                  onClick={handleBulkApprove} 
                  disabled={bulkActionLoading}
                  className="h-11 rounded-xl bg-primary px-6 font-black shadow-glow-primary hover:bg-primary/90 transition-all"
                >
                  {bulkActionLoading ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                    </motion.div>
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Post Batch
                </Button>

                <Button 
                  type="button" 
                  size="icon" 
                  variant="ghost" 
                  onClick={() => setSelectedIds([])}
                  className="h-11 w-11 rounded-xl text-muted-foreground hover:bg-muted"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={showBlitzSheet} onOpenChange={setShowBlitzSheet}>
        <SheetContent side="right" className="h-screen w-screen max-w-none p-0 border-none">
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
