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
import { Filter, RefreshCw, Send, X } from "@/components/icons"
import { INBOX_THEME_CLASSES } from "@/lib/design-system/inbox-theme"
import { cn } from "@/lib/utils"

import type { LocationOption } from "../types"
import type { ReviewFilter } from "@/lib/hooks"

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
    <section className="border-t border-slate-200/70 px-3 pb-2 pt-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors duration-200",
              expanded
                ? "bg-[#007aff]/10 text-[#007aff]"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
          </button>

          {!expanded && activeFiltersCount > 0 && (
            <span className="inline-flex h-5 items-center gap-1 rounded-md bg-slate-100 px-2 text-[10px] font-bold text-slate-600">
              {activeFiltersCount} active
              <button
                type="button"
                onClick={onReset}
                className="ml-0.5 rounded-full p-0.5 text-slate-400 transition-colors hover:text-slate-700"
                aria-label="Reset filters"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
        </div>

        <Button
          type="button"
          size="sm"
          className={cn(
            "h-8 rounded-xl px-4 text-xs font-bold transition-all duration-200",
            bulkApproveCount > 0 && bulkApproveEnabled && !bulkApproveLoading
              ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
              : "bg-slate-900 text-white hover:bg-slate-800"
          )}
          onClick={onBulkApprove}
          disabled={bulkApproveLoading || !bulkApproveEnabled || bulkApproveCount === 0}
        >
          {bulkApproveLoading ? (
            <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" />
          ) : (
            <Send className="mr-1.5 h-3 w-3" />
          )}
          Approve {bulkApproveCount}
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-2 scrollbar-none">
              <Select value={filter} onValueChange={(value) => onFilterChange(value as ReviewFilter)}>
                <SelectTrigger className="h-8 w-auto min-w-[100px] shrink-0 rounded-lg border-slate-200 bg-white text-xs font-semibold">
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
                  <SelectTrigger className="h-8 w-auto min-w-[100px] shrink-0 rounded-lg border-slate-200 bg-white text-xs font-semibold">
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
                  <SelectTrigger className="h-8 w-auto min-w-[100px] shrink-0 rounded-lg border-slate-200 bg-white text-xs font-semibold">
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
                <SelectTrigger className="h-8 w-auto min-w-[90px] shrink-0 rounded-lg border-slate-200 bg-white text-xs font-semibold">
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

              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={onReset}
                  className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  Reset
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
