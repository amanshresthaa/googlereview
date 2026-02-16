"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Filter, RefreshCw, Send, X } from "lucide-react"
import { cn } from "@/lib/utils"

import type { ReviewFilter } from "@/lib/hooks"
import type { LocationOption } from "../types"

type InboxFilterBarProps = {
  filter: ReviewFilter
  onFilterChange: (value: ReviewFilter) => void
  mentionFilter: string
  onMentionFilterChange: (value: string) => void
  mentionKeywords: string[]
  locationFilter: string
  onLocationFilterChange: (value: string) => void
  locations: LocationOption[]
  ratingFilter: string
  onRatingFilterChange: (value: string) => void
  activeFiltersCount: number
  onReset: () => void
  onBulkApprove: () => void
  bulkApproveCount: number
  bulkApproveLoading: boolean
  bulkApproveEnabled: boolean
}

const ICON_STROKE = 2.6

const FILTER_OPTIONS: Array<{ value: ReviewFilter; label: string }> = [
  { value: "unanswered", label: "Pending" },
  { value: "urgent", label: "Urgent" },
  { value: "five_star", label: "5 Star" },
  { value: "mentions", label: "Mentions" },
  { value: "all", label: "All" },
]

const RATING_OPTIONS = [
  { value: "all", label: "Any rating" },
  { value: "5", label: "5★" },
  { value: "4", label: "4★" },
  { value: "3", label: "3★" },
  { value: "2", label: "2★" },
  { value: "1", label: "1★" },
] as const

export function InboxFilterBar({
  filter,
  onFilterChange,
  mentionFilter,
  onMentionFilterChange,
  mentionKeywords,
  locationFilter,
  onLocationFilterChange,
  locations,
  ratingFilter,
  onRatingFilterChange,
  activeFiltersCount,
  onReset,
  onBulkApprove,
  bulkApproveCount,
  bulkApproveLoading,
  bulkApproveEnabled,
}: InboxFilterBarProps) {
  const [expanded, setExpanded] = React.useState(false)

  return (
    <section className="border-t border-white/45 bg-white/22 px-3 pb-3 pt-2.5 backdrop-blur-xl md:px-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-black uppercase tracking-[0.14em] transition-all duration-300 active:scale-95",
              expanded
                ? "border-[#007AFF]/35 bg-[#007AFF]/12 text-[#007AFF]"
                : "border-white/60 bg-white/60 text-slate-600 hover:bg-white",
            )}
          >
            <Filter className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} />
            Filters
          </button>

          {!expanded && activeFiltersCount > 0 ? (
            <span className="inline-flex h-8 items-center gap-1 rounded-full border border-white/60 bg-white/60 px-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">
              {activeFiltersCount} active
              <button
                type="button"
                onClick={onReset}
                className="rounded-full p-0.5 text-slate-500 transition-colors hover:text-slate-700"
                aria-label="Reset filters"
              >
                  <X className="h-3 w-3" strokeWidth={ICON_STROKE} />
              </button>
            </span>
          ) : null}
        </div>

        <Button
          type="button"
          size="sm"
          className={cn(
            "h-9 rounded-full px-4 text-[11px] font-black uppercase tracking-[0.14em] transition-all duration-300",
            bulkApproveCount > 0 && bulkApproveEnabled && !bulkApproveLoading
              ? "bg-black/90 text-white hover:bg-black"
              : "bg-white/80 text-slate-700 hover:bg-white",
          )}
          onClick={onBulkApprove}
          disabled={bulkApproveLoading || !bulkApproveEnabled || bulkApproveCount === 0}
        >
          {bulkApproveLoading ? (
            <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" strokeWidth={ICON_STROKE} />
          ) : (
            <Send className="mr-1.5 h-3 w-3" strokeWidth={ICON_STROKE} />
          )}
          Approve {bulkApproveCount}
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-2.5 flex items-center gap-2 overflow-x-auto pb-1">
              <Select value={filter} onValueChange={(value) => onFilterChange(value as ReviewFilter)}>
                <SelectTrigger className="h-9 min-w-[110px] rounded-full border-white/60 bg-white/70 px-3 text-xs font-semibold">
                  <SelectValue placeholder="Queue" />
                </SelectTrigger>
                <SelectContent>
                  {FILTER_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      disabled={option.value === "mentions" && mentionKeywords.length === 0}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {filter === "mentions" ? (
                <Select value={mentionFilter || ""} onValueChange={onMentionFilterChange}>
                  <SelectTrigger className="h-9 min-w-[115px] rounded-full border-white/60 bg-white/70 px-3 text-xs font-semibold">
                    <SelectValue placeholder="Keyword" />
                  </SelectTrigger>
                  <SelectContent>
                    {mentionKeywords.map((keyword) => (
                      <SelectItem key={keyword} value={keyword}>
                        {keyword}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={locationFilter} onValueChange={onLocationFilterChange}>
                  <SelectTrigger className="h-9 min-w-[125px] rounded-full border-white/60 bg-white/70 px-3 text-xs font-semibold">
                    <SelectValue placeholder="Location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All locations</SelectItem>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={ratingFilter} onValueChange={onRatingFilterChange}>
                <SelectTrigger className="h-9 min-w-[98px] rounded-full border-white/60 bg-white/70 px-3 text-xs font-semibold">
                  <SelectValue placeholder="Rating" />
                </SelectTrigger>
                <SelectContent>
                  {RATING_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {activeFiltersCount > 0 ? (
                <button
                  type="button"
                  onClick={onReset}
                  className="shrink-0 rounded-full border border-white/60 bg-white/65 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] text-slate-600 transition-all duration-300 hover:bg-white"
                >
                  Reset
                </button>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}
