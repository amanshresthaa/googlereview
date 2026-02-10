"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { useGlobalSearch } from "@/components/search-context"
import { cn } from "@/lib/utils"
import { formatAge, usePaginatedReviews, type ReviewFilter, type ReviewRow } from "@/lib/hooks"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  MessageSquare,
  Search,
  Star,
  AlertTriangle,
  MapPin,
  RefreshCw,
} from "@/components/icons"
import { ReviewDetail } from "@/components/ReviewDetail"

type Props = {
  initialFilter: ReviewFilter
  initialMention: string | null
  mentionKeywords: string[]
  bulkApproveEnabled: boolean
}

const FILTERS: Array<{ key: ReviewFilter; label: string; icon?: React.ComponentType<{ className?: string }> }> = [
  { key: "unanswered", label: "Needs reply" },
  { key: "urgent", label: "Urgent", icon: AlertTriangle },
  { key: "five_star", label: "5 Star", icon: Star },
  { key: "mentions", label: "Mentions" },
  { key: "all", label: "All" },
]

function useIsDesktop() {
  const [desktop, setDesktop] = React.useState(false)
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const update = () => setDesktop(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  return desktop
}

function initials(text: string) {
  const parts = text.trim().split(/\s+/).filter(Boolean)
  const a = parts[0]?.[0] ?? "?"
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : ""
  return (a + b).toUpperCase()
}

function StarsRow({ value }: { value: number }) {
  return (
    <div className="inline-flex items-center gap-0.5" aria-label={`${value} stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          weight={i < value ? "fill" : "regular"}
          className={cn(
            "h-4 w-4",
            i < value ? "fill-primary text-primary" : "text-muted-foreground/40"
          )}
        />
      ))}
    </div>
  )
}

function DraftBadge({ row }: { row: ReviewRow }) {
  if (!row.unanswered) {
    return (
      <Badge variant="secondary" className="rounded-md text-[9px] h-5 px-2 font-bold uppercase tracking-wider bg-primary/10 text-primary hover:bg-primary/10">
        Replied
      </Badge>
    )
  }

  if (row.draftStatus === "READY") {
    return (
      <Badge variant="secondary" className="rounded-md text-[9px] h-5 px-2 font-bold uppercase tracking-wider bg-primary/10 text-primary hover:bg-primary/10">
        Draft ready
      </Badge>
    )
  }

  if (row.draftStatus === "BLOCKED_BY_VERIFIER") {
    return (
      <Badge variant="secondary" className="rounded-md text-[9px] h-5 px-2 font-bold uppercase tracking-wider bg-rose-100 text-rose-700 hover:bg-rose-100">
        Flagged
      </Badge>
    )
  }

  if (row.draftStatus === "NEEDS_APPROVAL") {
    return (
      <Badge variant="secondary" className="rounded-md text-[9px] h-5 px-2 font-bold uppercase tracking-wider">
        Needs reply
      </Badge>
    )
  }

  return null
}

function ReviewCard({
  row,
  showCheckbox,
  checked,
  onCheckedChange,
  onOpen,
  index,
  selected,
}: {
  row: ReviewRow
  showCheckbox: boolean
  checked: boolean
  onCheckedChange: (val: boolean) => void
  onOpen: () => void
  index: number
  selected: boolean
}) {
  const initial = initials(row.snippet?.trim()?.[0] ?? "A")
  const isNegative = row.starRating <= 2

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.15), duration: 0.25 }}
      onClick={() => onOpen()}
      className={cn(
        "w-full rounded-2xl border border-border transition-all p-4 text-left group relative outline-none focus-visible:ring-4 focus-visible:ring-ring/30",
        selected
          ? "bg-primary/10 border-primary/30 shadow-card z-10"
          : "bg-card hover:border-primary/30 hover:shadow-elevated"
      )}
    >
      <div className="flex items-start gap-4">
        {showCheckbox && (
          <div onClick={(e) => e.stopPropagation()} className="pt-1">
            <Checkbox checked={checked} onCheckedChange={(v) => onCheckedChange(Boolean(v))} />
          </div>
        )}

        {/* Avatar */}
        <div className="relative">
          <Avatar className="h-11 w-11 flex-shrink-0 border border-border shadow-sm">
            <AvatarFallback className={cn("text-xs font-semibold", selected ? "bg-card text-primary" : "bg-muted text-muted-foreground")}>
              {initial}
            </AvatarFallback>
          </Avatar>
          {isNegative && (
            <div className="absolute -bottom-1 -right-1 bg-card rounded-full p-0.5 shadow-sm">
              <div className="bg-rose-500 h-3.5 w-3.5 rounded-full border-2 border-background" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className={cn("font-bold text-sm truncate", selected ? "text-foreground" : "text-foreground")}>
              {row.snippet ? `"${row.snippet.slice(0, 40)}..."` : "(No comment)"}
            </div>
            <div className="text-[10px] text-muted-foreground font-medium whitespace-nowrap mt-0.5">
              {formatAge(row.createTimeIso)}
            </div>
          </div>

          <div className="mt-1.5 flex items-center gap-2">
            <StarsRow value={row.starRating} />
          </div>

          <div className="mt-2.5 line-clamp-2 text-xs text-muted-foreground leading-relaxed font-medium">
            {row.snippet ? `"${row.snippet}"` : <span className="text-muted-foreground italic">(No comment)</span>}
          </div>

          <div className="mt-3.5 flex items-center justify-between gap-2 pt-3 border-t border-border/60">
            <div className="truncate text-[10px] text-muted-foreground font-medium flex items-center gap-1.5">
              <MapPin className="h-3 w-3" /> {row.location.displayName}
            </div>
            <DraftBadge row={row} />
          </div>
        </div>
      </div>
    </motion.button>
  )
}

function workerToast(worker: unknown) {
  const w = worker as null | { claimed?: number; results?: Array<{ ok: boolean; error?: string }> }
  const results = w?.results ?? []
  const failures = results.filter((r) => !r.ok)
  if (failures.length > 0) {
    toast.error(`${failures.length} job(s) failed`, { description: failures[0]?.error ?? "Unknown error" })
    return
  }
  if (results.length > 0) toast.success("Queued and processed")
  else toast.success("Queued")
}

export function InboxClient({ initialFilter, initialMention, mentionKeywords, bulkApproveEnabled }: Props) {
  const router = useRouter()
  const isDesktop = useIsDesktop()
  const { query } = useGlobalSearch()

  const [filter, setFilter] = React.useState<ReviewFilter>(initialFilter)
  const [mention, setMention] = React.useState<string>(initialMention ?? "")
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  const mentionParam = filter === "mentions" && mention.trim() ? mention.trim() : undefined
  const { rows, counts, loading, loadingMore, error, hasMore, loadMore, refresh } =
    usePaginatedReviews({ filter, mention: mentionParam })

  React.useEffect(() => {
    if (error === "SESSION_EXPIRED") router.replace("/signin")
    else if (error) toast.error(error)
  }, [error, router])

  React.useEffect(() => {
    if (filter !== "mentions") return
    if (mention.trim()) return
    if (mentionKeywords.length === 0) return
    setMention(mentionKeywords[0]!)
  }, [filter, mention, mentionKeywords])

  const visibleRows = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      return (
        r.snippet.toLowerCase().includes(q) ||
        r.location.displayName.toLowerCase().includes(q) ||
        String(r.starRating).includes(q) ||
        r.mentions.some((m) => m.toLowerCase().includes(q))
      )
    })
  }, [rows, query])

  // Auto-select first on desktop
  React.useEffect(() => {
    if (!isDesktop) return
    if (selectedId) return
    if (visibleRows.length === 0) return
    setSelectedId(visibleRows[0]!.id)
  }, [isDesktop, selectedId, visibleRows])

  // Keyboard navigation
  React.useEffect(() => {
    if (!isDesktop) return
    if (visibleRows.length === 0) return

    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const tag = t?.tagName ?? ""
      if (tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable) return
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "j" && e.key !== "k") return
      e.preventDefault()

      const curIndex = Math.max(0, visibleRows.findIndex((r) => r.id === selectedId))
      const nextIndex =
        e.key === "ArrowDown" || e.key === "j"
          ? Math.min(curIndex + 1, visibleRows.length - 1)
          : Math.max(curIndex - 1, 0)

      setSelectedId(visibleRows[nextIndex]!.id)
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [isDesktop, selectedId, visibleRows])

  // Bulk approve logic
  const eligibleIds = React.useMemo(() => {
    return rows
      .filter((r) => r.unanswered && r.starRating === 5 && r.draftStatus === "READY")
      .map((r) => r.id)
  }, [rows])

  const showBulk = filter === "five_star" && bulkApproveEnabled && eligibleIds.length > 0
  const [checked, setChecked] = React.useState<Set<string>>(new Set())
  const selectedEligible = React.useMemo(() => Array.from(checked).filter((id) => eligibleIds.includes(id)), [checked, eligibleIds])

  React.useEffect(() => { setChecked(new Set()) }, [filter, mention])

  const updateUrl = React.useCallback(
    (nextFilter: ReviewFilter, nextMention: string) => {
      const params = new URLSearchParams()
      params.set("filter", nextFilter)
      if (nextFilter === "mentions" && nextMention.trim()) params.set("mention", nextMention.trim())
      router.replace(`/inbox?${params.toString()}`, { scroll: false })
    },
    [router]
  )

  const selectRow = (id: string) => {
    setSelectedId(id)
    if (!isDesktop) router.push(`/reviews/${id}`)
  }

  const toggleCheck = (id: string, val: boolean) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (val) {
        if (next.size >= 50) { toast.error("Max 50 per bulk action."); return next }
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }

  const selectAllEligible = () => setChecked(() => new Set(eligibleIds.slice(0, 50)))

  const bulkApprove = async () => {
    const reviewIds = selectedEligible.slice(0, 50)
    if (reviewIds.length === 0) return
    try {
      const res = await fetch("/api/replies/bulk-approve", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
        },
        body: JSON.stringify({ reviewIds }),
      })
      if (res.status === 401) { router.replace("/signin"); return }
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? res.statusText)
      workerToast(data?.worker)
      setChecked(new Set())
      refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)) }
  }

  return (
    <div className="h-full">
      <div className={cn("h-full", isDesktop && "lg:flex lg:gap-0")}>
        {/* ── List Pane ── */}
        <div
          className={cn(
            "w-full flex flex-col",
            isDesktop ? "w-[440px] shrink-0 border-r border-border bg-card lg:h-[calc(100vh-0px)] z-10 shadow-elevated" : "min-h-screen bg-background"
          )}
        >
          {/* Header */}
          <div className="h-18 px-6 border-b border-border flex items-center justify-between shrink-0 bg-card/95 backdrop-blur-md sticky top-0 z-10">
            <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-3">
              Reviews
              <Badge variant="secondary" className="rounded-md px-2 text-[11px] h-6 font-semibold bg-muted text-muted-foreground">
                {visibleRows.length}
              </Badge>
            </h1>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => refresh()} disabled={loading} className="rounded-xl hover:bg-accent text-muted-foreground">
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
            </div>
          </div>

          {/* Filter Chips */}
          <div className="p-5 border-b border-border bg-card">
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex gap-3 pb-1">
                {FILTERS.map((f) => {
                  const active = filter === f.key
                  const Icon = f.icon
                  const count =
                    f.key === "unanswered" ? counts?.unanswered
                      : f.key === "urgent" ? counts?.urgent
                        : f.key === "five_star" ? counts?.five_star
                          : f.key === "mentions" ? counts?.mentions_total
                            : undefined

                  return (
                    <button
                      key={f.key}
                      type="button"
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap border relative inline-flex items-center gap-1.5",
                        active
                          ? "bg-primary/10 text-primary border-primary/30"
                          : "bg-card text-muted-foreground border-border hover:bg-accent"
                      )}
                      onClick={() => { setFilter(f.key); updateUrl(f.key, mention) }}
                    >
                      {Icon && <Icon className="size-3" />}
                      {f.label}
                      {count != null && (
                        <span className={cn(
                          "text-[10px] tabular-nums",
                          active ? "text-primary/70" : "text-muted-foreground/70"
                        )}>
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Mention Sub-filter */}
          {filter === "mentions" && (
            <div className="px-5 py-3 border-b border-border flex flex-wrap gap-2 bg-muted/40">
              {mentionKeywords.length === 0 ? (
                <p className="text-xs text-muted-foreground font-medium">
                  Add mention keywords in Settings → AI Tone.
                </p>
              ) : (
                mentionKeywords.map((k) => {
                  const active = mention.trim() === k
                  return (
                    <button
                      key={k}
                      type="button"
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border",
                        active
                          ? "bg-primary/10 text-primary border-primary/30"
                          : "bg-card text-muted-foreground border-border hover:bg-accent"
                      )}
                      onClick={() => { setMention(k); updateUrl("mentions", k) }}
                    >
                      {k}
                    </button>
                  )
                })
              )}
            </div>
          )}

          {/* Bulk Approve */}
          {showBulk && (
            <div className="px-5 py-3 border-b border-border bg-primary/10">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground font-medium">
                  {eligibleIds.length} ready • Select up to 50
                </p>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={selectAllEligible} className="h-7 text-xs rounded-lg border-border">
                    All
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button type="button" size="sm" disabled={selectedEligible.length === 0} className="h-7 text-xs rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground">
                        Approve ({selectedEligible.length})
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Bulk approve replies?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will post replies for {selectedEligible.length} review(s).
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={bulkApprove}>Approve</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          )}

          {/* Review List */}
          <ScrollArea className="flex-1 bg-card">
            <div className="p-4 pb-20">
              <div className="space-y-3">
                {loading && rows.length === 0 ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex items-start gap-4">
                        <Skeleton className="h-11 w-11 rounded-full" />
                        <div className="flex-1 space-y-2.5">
                          <Skeleton className="h-3 w-24 rounded" />
                          <Skeleton className="h-4 w-full rounded" />
                          <Skeleton className="h-3 w-2/3 rounded" />
                        </div>
                      </div>
                    </div>
                  ))
                ) : visibleRows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24">
                    <div className="h-24 w-24 bg-card shadow-sm rounded-3xl flex items-center justify-center mb-6 border border-border">
                      <Search className="h-10 w-10 opacity-20" />
                    </div>
                    <p className="text-sm font-medium text-foreground">No reviews found</p>
                    <p className="text-xs text-muted-foreground mt-1.5">Try adjusting filters or search.</p>
                  </div>
                ) : (
                  <>
                    <AnimatePresence initial={false} mode="popLayout">
                      {visibleRows.map((row, idx) => (
                        <ReviewCard
                          key={row.id}
                          row={row}
                          showCheckbox={showBulk && eligibleIds.includes(row.id)}
                          checked={checked.has(row.id)}
                          onCheckedChange={(v) => toggleCheck(row.id, v)}
                          onOpen={() => selectRow(row.id)}
                          index={idx}
                          selected={row.id === selectedId}
                        />
                      ))}
                    </AnimatePresence>
                  </>
                )}

                {/* Load more */}
                <div className="flex items-center justify-center py-4">
                  {hasMore ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={loadingMore}
                      onClick={() => loadMore()}
                      className="rounded-xl text-xs border-border text-muted-foreground hover:bg-accent"
                    >
                      {loadingMore ? "Loading..." : "Load more"}
                    </Button>
                  ) : visibleRows.length > 0 ? (
                    <p className="text-[10px] text-muted-foreground/50 font-medium">End of list</p>
                  ) : null}
                </div>
              </div>

              {/* Keyboard Shortcut Hint */}
              <div className="hidden lg:flex items-center justify-center gap-4 text-[10px] text-muted-foreground font-medium pt-4 pb-2 opacity-60">
                <span className="flex items-center gap-1">
                  <kbd className="bg-card border border-border rounded px-1 min-w-[18px] text-center shadow-sm">↓</kbd> /
                  <kbd className="bg-card border border-border rounded px-1 min-w-[18px] text-center shadow-sm">j</kbd> Next
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="bg-card border border-border rounded px-1 min-w-[18px] text-center shadow-sm">↑</kbd> /
                  <kbd className="bg-card border border-border rounded px-1 min-w-[18px] text-center shadow-sm">k</kbd> Prev
                </span>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* ── Detail Pane (desktop) ── */}
        {isDesktop && (
          <div className="flex-1 lg:h-[calc(100vh-0px)] overflow-auto scrollbar-thin bg-muted/40">
            <AnimatePresence mode="wait">
              {selectedId ? (
                <motion.div
                  key={selectedId}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.2 }}
                  className="p-6"
                >
                  <ReviewDetail reviewId={selectedId} />
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center h-full text-muted-foreground"
                >
                  <div className="h-24 w-24 bg-card shadow-sm rounded-3xl flex items-center justify-center mb-6 border border-border">
                    <MessageSquare className="h-10 w-10 opacity-20" />
                  </div>
                  <p className="text-sm font-medium">Select a review to start drafting</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Use <kbd className="bg-card border border-border rounded px-1 min-w-[18px] text-center shadow-sm text-[10px]">↑</kbd>{" "}
                    <kbd className="bg-card border border-border rounded px-1 min-w-[18px] text-center shadow-sm text-[10px]">↓</kbd> or{" "}
                    <kbd className="bg-card border border-border rounded px-1 min-w-[18px] text-center shadow-sm text-[10px]">j</kbd>{" "}
                    <kbd className="bg-card border border-border rounded px-1 min-w-[18px] text-center shadow-sm text-[10px]">k</kbd> to navigate
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
