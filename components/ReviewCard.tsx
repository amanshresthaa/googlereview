"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { formatAge, type ReviewRow } from "@/lib/hooks"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { Star, MapPin, CheckCircle2, AlertTriangle, Clock } from "@/components/icons"

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const a = parts[0]?.[0] ?? "?"
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : ""
  return (a + b).toUpperCase()
}

function SparklesIcon({ className, weight }: { className?: string; weight?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" className={className} fill="currentColor">
      <title>Sparkles</title>
      {weight === "fill" ? (
        <path d="M216 112a8 8 0 0 1-8 8 80.1 80.1 0 0 0-80 80 8 8 0 0 1-16 0 80.1 80.1 0 0 0-80-80 8 8 0 0 1 0-16 80.1 80.1 0 0 0 80-80 8 8 0 0 1 16 0 80.1 80.1 0 0 0 80 80 8 8 0 0 1 8 8Z" />
      ) : (
        <path d="M216 112a8 8 0 0 1-8 8 80.1 80.1 0 0 0-80 80 8 8 0 0 1-16 0 80.1 80.1 0 0 0-80-80 8 8 0 0 1 0-16 80.1 80.1 0 0 0 80-80 8 8 0 0 1 16 0 80.1 80.1 0 0 0 80 80 8 8 0 0 1 8 8Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16" />
      )}
    </svg>
  )
}

function StarsRow({ value }: { value: number }) {
  return (
    <div className="inline-flex items-center gap-0.5" role="img" aria-label={`${value} stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={`star-${i}-${value}`}
          weight={i < value ? "fill" : "regular"}
          className={cn(
            "h-3.5 w-3.5",
            i < value ? "fill-primary text-primary" : "text-muted-foreground/30"
          )}
        />
      ))}
    </div>
  )
}

function StatusBadge({ row }: { row: ReviewRow }) {
  if (!row.unanswered) {
    return (
      <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100/50">
        <CheckCircle2 className="size-3" weight="fill" />
        <span>Replied</span>
      </div>
    )
  }

  if (row.draftStatus === "READY") {
    return (
      <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full border border-blue-100/50">
        <SparklesIcon className="size-3" weight="fill" />
        <span>Draft Ready</span>
      </div>
    )
  }

  if (row.draftStatus === "BLOCKED_BY_VERIFIER") {
    return (
      <div className="flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-full border border-rose-100/50">
        <AlertTriangle className="size-3" weight="fill" />
        <span>Flagged</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-100/50">
      <Clock className="size-3" weight="fill" />
      <span>Needs Reply</span>
    </div>
  )
}

export const ReviewCard = React.memo(function ReviewCard({
  reviewId,
  row,
  showCheckbox,
  checked,
  onCheckedChange,
  onOpen,
  selected,
}: {
  reviewId: string
  row: ReviewRow
  showCheckbox: boolean
  checked: boolean
  onCheckedChange: (reviewId: string, val: boolean) => void
  onOpen: (reviewId: string) => void
  selected: boolean
}) {
  const name = row.reviewer.displayName || "Anonymous"
  const initial = initials(name)
  const isNegative = row.starRating <= 2

  return (
    <div
      onClick={() => onOpen(reviewId)}
      className={cn(
        // Avoid layout/entrance animations for list items; it degrades scroll/typing smoothness as the list grows.
        "group relative w-full rounded-2xl transition-colors duration-200 border border-transparent select-none cursor-pointer",
        selected
          ? "bg-primary/5 border-primary/10 shadow-sm z-10"
          : "bg-card hover:bg-muted/30 hover:border-border/60 shadow-card hover:shadow-elevated"
      )}
    >
      <div className="p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <Avatar className="h-10 w-10 border border-border/40 shadow-sm transition-transform group-hover:scale-105">
                <AvatarFallback className={cn("text-xs font-bold", selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                  {initial}
                </AvatarFallback>
              </Avatar>
              {isNegative && (
                <div className="absolute -bottom-0.5 -right-0.5 bg-background rounded-full p-0.5 shadow-sm ring-1 ring-border">
                  <div className="bg-rose-500 h-2.5 w-2.5 rounded-full" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm truncate text-foreground leading-tight">
                {name}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium mt-0.5">
                 <MapPin className="size-3 shrink-0 opacity-70" />
                 <span className="truncate">{row.location.displayName}</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-1 shrink-0">
             <span className="text-[10px] text-muted-foreground font-semibold tabular-nums opacity-60">
               {formatAge(row.createTimeIso)}
             </span>
             {showCheckbox ? (
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                  }}
                  className="pt-1 flex items-center justify-center"
                >
                  <Checkbox checked={checked} onCheckedChange={(v) => onCheckedChange(reviewId, Boolean(v))} />
                </div>
             ) : (
                <StarsRow value={row.starRating} />
             )}
          </div>
        </div>

        <div className="pl-[52px]">
          <p className={cn(
             "text-sm leading-relaxed line-clamp-2", 
             row.snippet ? "text-muted-foreground/90" : "text-muted-foreground/40 italic"
          )}>
            {row.snippet || "No written comment"}
          </p>
        </div>

        <div className="pl-[52px] flex items-center justify-between pt-1">
          <StatusBadge row={row} />
        </div>
      </div>
      
      {selected && (
        <div className="absolute left-0 top-3 bottom-3 w-1 bg-primary rounded-r-full" />
      )}
    </div>
  )
})
ReviewCard.displayName = "ReviewCard"
