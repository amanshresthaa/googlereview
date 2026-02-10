"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import type { ReviewFilter, ReviewCounts } from "@/lib/hooks"

type Props = {
  filter: ReviewFilter
  mention: string | null
  mentionKeywords: string[]
  counts: ReviewCounts | null
  onFilterChange: (filter: ReviewFilter, mention?: string) => void
}

function Pill({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean
  label: string
  count?: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-emerald-600 text-white"
          : "bg-stone-100 text-stone-600 hover:bg-stone-200"
      )}
    >
      {label}
      {count !== undefined && (
        <span
          className={cn(
            "ml-1.5 tabular-nums",
            active ? "text-emerald-200" : "text-stone-400"
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}

export function InboxFilters({
  filter,
  mention,
  mentionKeywords,
  counts,
  onFilterChange,
}: Props) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto px-4 py-2 scrollbar-none">
      <Pill
        active={filter === "unanswered"}
        label="Unanswered"
        count={counts?.unanswered}
        onClick={() => onFilterChange("unanswered")}
      />
      <Pill
        active={filter === "urgent"}
        label="Urgent 1-2★"
        count={counts?.urgent}
        onClick={() => onFilterChange("urgent")}
      />
      <Pill
        active={filter === "five_star"}
        label="5★"
        count={counts?.five_star}
        onClick={() => onFilterChange("five_star")}
      />
      {mentionKeywords.map((kw) => (
        <Pill
          key={kw}
          active={filter === "mentions" && mention === kw}
          label={kw}
          onClick={() => onFilterChange("mentions", kw)}
        />
      ))}
    </div>
  )
}
