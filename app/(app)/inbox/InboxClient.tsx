"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { withIdempotencyHeader } from "@/lib/api/client-idempotency"
import { usePaginatedReviews, type ReviewFilter, type ReviewRow } from "@/lib/hooks"
import { BlitzMode, ReviewItem } from "@/app/(app)/inbox/inbox-ui"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  CheckCircle2,
  MessageSquare,
  RefreshCw,
  Search,
} from "@/components/icons"

type LocationOption = {
  id: string
  displayName: string
}

type Props = {
  initialFilter: ReviewFilter
  initialMention: string | null
  mentionKeywords: string[]
  bulkApproveEnabled: boolean
  locations: LocationOption[]
  initialPage: {
    filter: ReviewFilter
    mention?: string | null
    rows: ReviewRow[]
    counts?: {
      unanswered: number
      urgent: number
      five_star: number
      mentions_total: number
    }
    nextCursor: string | null
  } | null
}

async function apiCall(url: string, method: string, body?: unknown) {
  const upper = method.toUpperCase()
  const mutating = ["POST", "PUT", "PATCH", "DELETE"].includes(upper)
  const baseHeaders = body ? { "content-type": "application/json" } : undefined
  const headers = mutating ? withIdempotencyHeader(baseHeaders) : baseHeaders
  const res = await fetch(url, {
    method: upper,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const message = data?.error ?? res.statusText
    throw new Error(message)
  }
  return data
}

function canBulkApprove(row: ReviewRow) {
  return row.status === "pending" && row.starRating === 5 && row.draftStatus === "READY"
}

async function waitForReadyDraft(reviewId: string, timeoutMs: number = 4500) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`/api/reviews/${reviewId}`)
    if (res.ok) {
      const data = await res.json().catch(() => null)
      if (data?.currentDraft?.status === "READY") return true
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return false
}

async function waitForDraftChange(reviewId: string, previousDraftId: string | null, timeoutMs: number = 5000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`/api/reviews/${reviewId}`)
    if (res.ok) {
      const data = await res.json().catch(() => null)
      const currentDraftId = data?.currentDraft?.id ?? null
      if (previousDraftId == null) {
        if (currentDraftId != null) return true
      } else if (currentDraftId !== previousDraftId) {
        return true
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return false
}

export function InboxClient({
  initialFilter,
  initialMention,
  mentionKeywords,
  bulkApproveEnabled,
  locations,
  initialPage,
}: Props) {
  void initialMention
  void mentionKeywords
  const initialTab = initialFilter === "all" ? "all" : initialFilter === "five_star" ? "pending" : "pending"
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [searchQuery, setSearchQuery] = React.useState("")
  const [locationFilter, setLocationFilter] = React.useState("all")
  const [ratingFilter, setRatingFilter] = React.useState("all")
  const [activeTab, setActiveTab] = React.useState<"all" | "pending" | "replied">(initialTab as "all" | "pending" | "replied")
  const [isBulkActionLoading, setIsBulkActionLoading] = React.useState(false)
  const [blitzMode, setBlitzMode] = React.useState(false)
  const remoteFilter: ReviewFilter = activeTab === "pending" ? "unanswered" : "all"
  const { rows, counts, loading, loadingMore, error, hasMore, loadMore, refresh } = usePaginatedReviews({
    filter: remoteFilter,
    initialPage,
  })

  React.useEffect(() => {
    if (!error) return
    toast.error(error)
  }, [error])

  React.useEffect(() => {
    const open = () => setBlitzMode(true)
    window.addEventListener("replyai:open-blitz", open)
    return () => window.removeEventListener("replyai:open-blitz", open)
  }, [])

  const filteredReviews = React.useMemo(() => {
    return rows.filter((r) => {
      const q = searchQuery.trim().toLowerCase()
      const matchesSearch =
        q.length === 0 ||
        (r.reviewer.displayName ?? "").toLowerCase().includes(q) ||
        r.comment.toLowerCase().includes(q) ||
        r.location.displayName.toLowerCase().includes(q)
      const matchesLocation = locationFilter === "all" || r.location.id === locationFilter
      const matchesRating = ratingFilter === "all" || String(r.starRating) === ratingFilter
      const matchesTab =
        activeTab === "all" || (activeTab === "pending" ? r.status === "pending" : r.status === "replied")
      return matchesSearch && matchesLocation && matchesRating && matchesTab
    })
  }, [rows, searchQuery, locationFilter, ratingFilter, activeTab])

  const pendingCount = counts?.unanswered ?? rows.filter((r) => r.status === "pending").length

  const eligibleSelectedIds = React.useMemo(
    () =>
      selectedIds.filter((id) => {
        const row = rows.find((r) => r.id === id)
        return row ? canBulkApprove(row) : false
      }),
    [rows, selectedIds]
  )

  const pendingForBlitz = React.useMemo(() => rows.filter((r) => r.status === "pending"), [rows])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const selectAllFiveStars = () => {
    setSelectedIds(filteredReviews.filter(canBulkApprove).map((r) => r.id))
  }

  const generateDraft = async (reviewId: string) => {
    const previousDraftId = rows.find((row) => row.id === reviewId)?.currentDraft?.id ?? null
    const result = await apiCall(`/api/reviews/${reviewId}/drafts/generate`, "POST")
    const claimed = Number(result?.worker?.claimed ?? 0)
    if (claimed > 0) {
      toast.success("Draft regenerated")
    } else {
      const changed = await waitForDraftChange(reviewId, previousDraftId)
      toast.success(changed ? "Draft regenerated" : "Draft generation queued")
    }
    refresh()
  }

  const saveDraft = async (reviewId: string, text: string) => {
    await apiCall(`/api/reviews/${reviewId}/drafts/edit`, "POST", { text })
    toast.success("Draft saved")
    refresh()
  }

  const publishReply = async (reviewId: string, text: string, row: ReviewRow) => {
    if (!text.trim()) throw new Error("Draft is empty.")
    const current = row.currentDraft?.text.trim() ?? ""
    const incoming = text.trim()
    if (current !== incoming) {
      await apiCall(`/api/reviews/${reviewId}/drafts/edit`, "POST", { text: incoming })
    }

    await apiCall(`/api/reviews/${reviewId}/drafts/verify`, "POST")
    await waitForReadyDraft(reviewId)
    await apiCall(`/api/reviews/${reviewId}/reply/post`, "POST")

    toast.success("Reply published")
    refresh()
  }

  const handleBulkApprove = async () => {
    if (!bulkApproveEnabled) {
      toast.error("Bulk approve is disabled in settings.")
      return
    }
    if (eligibleSelectedIds.length === 0) {
      toast.error("Select 5-star pending reviews with READY drafts.")
      return
    }
    setIsBulkActionLoading(true)
    try {
      await apiCall("/api/replies/bulk-approve", "POST", { reviewIds: eligibleSelectedIds.slice(0, 50) })
      toast.success("Bulk approve requested")
      setSelectedIds([])
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk approve failed")
    } finally {
      setIsBulkActionLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Card className="rounded-none border-x-0 border-t-0 sticky top-0 z-10">
        <CardContent className="px-6 py-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                type="text"
                placeholder="Search by author, location or keywords..."
                className="pl-10 h-10 bg-zinc-50 border-zinc-200 text-sm focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-0"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-[180px] h-10 bg-white border-zinc-200 text-sm font-medium">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={ratingFilter} onValueChange={setRatingFilter}>
              <SelectTrigger className="w-[150px] h-10 bg-white border-zinc-200 text-sm font-medium">
                <SelectValue placeholder="Any Rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Rating</SelectItem>
                <SelectItem value="5">5 Stars Only</SelectItem>
                <SelectItem value="4">4 Stars</SelectItem>
                <SelectItem value="3">3 Stars</SelectItem>
                <SelectItem value="2">2 Stars</SelectItem>
                <SelectItem value="1">1 Star</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <ToggleGroup
              type="single"
              value={activeTab}
              onValueChange={(value) => {
                if (value === "all" || value === "pending" || value === "replied") {
                  setActiveTab(value)
                }
              }}
              className="bg-zinc-100 p-1 rounded-lg gap-1"
            >
              {(["all", "pending", "replied"] as const).map((tab) => (
                <ToggleGroupItem
                  key={tab}
                  value={tab}
                  className={cn(
                    "px-4 py-1.5 text-sm font-medium rounded-md transition-all capitalize",
                    "data-[state=on]:bg-white data-[state=on]:text-blue-600 data-[state=on]:shadow-sm",
                    "text-zinc-500 hover:text-zinc-700"
                  )}
                >
                  {tab}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs font-semibold text-zinc-600 bg-zinc-100 border-transparent">
                {pendingCount} pending
              </Badge>
              <Button type="button" variant="ghost" size="sm" onClick={selectAllFiveStars} className="text-xs font-semibold text-blue-600 hover:bg-blue-50 px-2 py-1.5 rounded h-auto">
                Select 5-Stars
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => refresh()} className="text-xs font-semibold text-zinc-500 hover:bg-zinc-50 px-2 py-1.5 rounded h-auto inline-flex items-center gap-1">
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AnimatePresence>
        {selectedIds.length > 0 ? (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-20 lg:bottom-10 left-1/2 -translate-x-1/2 bg-zinc-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 z-50 border border-white/10"
          >
            <div className="flex items-center gap-3 border-r border-white/20 pr-6">
              <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center font-bold text-sm">
                {selectedIds.length}
              </div>
              <p className="text-sm font-medium">Reviews selected</p>
            </div>

            <div className="flex items-center gap-4">
              <Button
                onClick={handleBulkApprove}
                disabled={isBulkActionLoading}
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-70 text-white"
              >
                {isBulkActionLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                <span>Approve & Publish</span>
              </Button>

              <Button type="button" variant="ghost" onClick={() => setSelectedIds([])} className="text-sm font-medium text-zinc-400 hover:text-white transition-colors h-auto p-0">
                Cancel
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-4">
          {filteredReviews.length === 0 ? (
            <Card className="h-full min-h-[360px] flex flex-col items-center justify-center text-center py-20 border-zinc-200">
              <CardContent className="pt-6">
                <div className="h-16 w-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <MessageSquare className="h-8 w-8 text-zinc-300" />
                </div>
                <h3 className="text-lg font-medium text-zinc-900">No reviews found</h3>
                <p className="text-zinc-500 max-w-xs">Try adjusting your filters or search query.</p>
              </CardContent>
            </Card>
          ) : (
            filteredReviews.map((review) => (
              <ReviewItem
                key={review.id}
                review={review}
                isSelected={selectedIds.includes(review.id)}
                onToggle={() => toggleSelect(review.id)}
                onGenerate={generateDraft}
                onSave={saveDraft}
                onPublish={publishReply}
              />
            ))
          )}

          {hasMore ? (
            <div className="pt-2">
              <Button type="button" variant="outline" className="w-full" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Loading..." : "Load more reviews"}
              </Button>
            </div>
          ) : null}
        </div>
      </ScrollArea>

      <AnimatePresence>
        {blitzMode ? (
          <BlitzMode
            reviews={pendingForBlitz}
            onClose={() => setBlitzMode(false)}
            onGenerate={generateDraft}
            onPublish={publishReply}
          />
        ) : null}
      </AnimatePresence>
    </div>
  )
}
