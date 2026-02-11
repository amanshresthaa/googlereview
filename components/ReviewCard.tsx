"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { formatAge, type ReviewRow } from "@/lib/hooks"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { CheckCircle2, Clock, MessageSquare, RefreshCw, Sparkles, Star } from "@/components/icons"

const AVATAR_COLORS = [
  "bg-blue-600 text-white",
  "bg-emerald-600 text-white",
  "bg-violet-600 text-white",
  "bg-rose-600 text-white",
  "bg-amber-600 text-white",
  "bg-cyan-600 text-white",
  "bg-fuchsia-600 text-white",
  "bg-teal-600 text-white",
] as const

function nameHash(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const a = parts[0]?.[0] ?? "?"
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : ""
  return (a + b).toUpperCase()
}

function borderAccent(row: ReviewRow): string {
  if (row.starRating <= 2 || row.draftStatus === "BLOCKED_BY_VERIFIER") return "bg-red-500"
  if (row.status === "replied") return "bg-emerald-500"
  return "bg-amber-500"
}

function stars(value: number) {
  return Array.from({ length: 5 }, (_, i) => {
    const filled = i < value
    return (
      <Star
        key={`${value}-${String(i)}`}
        weight={filled ? "fill" : "regular"}
        className={cn(
          "h-3.5 w-3.5",
          filled
            ? "text-[#fbbc04] dark:text-[#fdd663]"
            : "text-muted-foreground/30"
        )}
      />
    )
  })
}

export const ReviewCard = React.memo(function ReviewCard({
  reviewId,
  row,
  showCheckbox,
  checked,
  onCheckedChange,
  onOpen,
  selected,
  showQuickApprove,
  onQuickApprove,
  quickApproveLoading,
}: {
  reviewId: string
  row: ReviewRow
  showCheckbox: boolean
  checked: boolean
  onCheckedChange: (reviewId: string, val: boolean) => void
  onOpen: (reviewId: string) => void
  selected: boolean
  showQuickApprove?: boolean
  onQuickApprove?: (reviewId: string) => void
  quickApproveLoading?: boolean
}) {
  const name = row.reviewer.displayName || "Anonymous"
  const avatarColor = AVATAR_COLORS[nameHash(name) % AVATAR_COLORS.length]
  const canQuickApprove = row.status === "pending" && row.draftStatus === "READY"
  const isReplied = row.status === "replied"

  return (
    <article
      onClick={() => onOpen(reviewId)}
      className={cn(
        "group relative flex cursor-pointer gap-3 overflow-hidden rounded-xl border p-3 transition-all duration-200 sm:p-4",
        selected
          ? "border-blue-400/60 bg-blue-50/80 shadow-md ring-1 ring-blue-400/25 dark:border-blue-500/50 dark:bg-blue-950/40 dark:ring-blue-500/20"
          : "border-border bg-card hover:bg-accent/50 dark:hover:bg-accent/30"
      )}
      aria-label={`Review by ${name}`}
    >
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-1 rounded-l-xl transition-colors",
          selected ? "bg-blue-500 dark:bg-blue-400" : borderAccent(row)
        )}
      />

      {showCheckbox && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex shrink-0 items-start pt-1"
        >
          <Checkbox
            checked={checked}
            onCheckedChange={(v) => onCheckedChange(reviewId, Boolean(v))}
            className="h-4.5 w-4.5"
          />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className={cn("text-xs font-semibold", avatarColor)}>
                {initials(name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{name}</p>
              <span className="text-[11px] text-muted-foreground">{formatAge(row.createTimeIso)}</span>
            </div>
          </div>

          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
              isReplied
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
            )}
          >
            {isReplied ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <Clock className="h-3 w-3" />
            )}
            {isReplied ? "Replied" : "Pending"}
          </span>
        </div>

        <div className="mt-2 flex items-center gap-0.5" role="img" aria-label={`${row.starRating} stars`}>
          {stars(row.starRating)}
        </div>

        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
          {row.snippet
            ? <>&ldquo;{row.snippet}&rdquo;</>
            : <span className="italic">No written comment provided.</span>}
        </p>

        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" />
            {isReplied ? "View conversation" : "Quick reply available"}
          </span>

          {showQuickApprove && (
            <button
              type="button"
              disabled={!canQuickApprove || quickApproveLoading}
              onClick={(e) => {
                e.stopPropagation()
                if (canQuickApprove) onQuickApprove?.(reviewId)
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                "opacity-100 sm:pointer-events-none sm:translate-y-0.5 sm:opacity-0",
                "sm:group-hover:pointer-events-auto sm:group-hover:translate-y-0 sm:group-hover:opacity-100",
                "sm:group-focus-within:pointer-events-auto sm:group-focus-within:translate-y-0 sm:group-focus-within:opacity-100",
                canQuickApprove
                  ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                  : "border border-border text-muted-foreground",
                "disabled:opacity-50"
              )}
            >
              {quickApproveLoading ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : canQuickApprove ? (
                <Sparkles className="h-3.5 w-3.5" />
              ) : null}
              {canQuickApprove ? "Approve" : "Dismiss"}
            </button>
          )}
        </div>
      </div>
    </article>
  )
})

ReviewCard.displayName = "ReviewCard"
