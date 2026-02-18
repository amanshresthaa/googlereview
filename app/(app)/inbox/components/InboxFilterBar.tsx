"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CheckCheck, Filter, RefreshCw, SlidersHorizontal, X } from "lucide-react"
import { INBOX_THEME_CLASSES } from "@/lib/design-system/inbox-theme"
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

const FILTER_PANEL_ID = "inbox-filter-panel"

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
    <section className={INBOX_THEME_CLASSES.filterSection}>
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
            aria-controls={FILTER_PANEL_ID}
            className={cn(
              "h-8 px-3",
              INBOX_THEME_CLASSES.filterToggle,
              expanded
                ? INBOX_THEME_CLASSES.filterToggleActive
                : INBOX_THEME_CLASSES.filterToggleIdle,
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            {activeFiltersCount > 0 && (
              <span className="ml-1 text-brand-muted">{activeFiltersCount}</span>
            )}
          </Button>

          {activeFiltersCount > 0 && !expanded ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onReset}
              className="h-8 w-8 text-shell-foreground/40 transition-colors hover:bg-transparent hover:text-shell-foreground/60"
              aria-label="Reset filters"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : null}

          <Separator orientation="vertical" className="mx-1 h-6 bg-shell-foreground/10" />

          <div className="flex items-center gap-1 text-xs font-bold tracking-widest text-shell-foreground/40 uppercase">
            <SlidersHorizontal className="h-3 w-3" /> Sort by Relevance
          </div>
        </div>

        {bulkApproveEnabled && bulkApproveCount > 0 ? (
          <Button
            type="button"
            size="sm"
            className={cn(
              "h-8 shrink-0",
              !bulkApproveLoading
                ? "bg-transparent border-none text-success-soft hover:text-success/80 text-xs font-bold"
                : "bg-transparent border-none text-shell-foreground/40 text-xs font-bold",
            )}
            onClick={onBulkApprove}
            disabled={bulkApproveLoading || bulkApproveCount === 0}
            aria-label={`Bulk approve ${bulkApproveCount} reviews`}
          >
            {bulkApproveLoading ? (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCheck className="mr-1.5 h-4 w-4" />
            )}
            Bulk Approve Ready
          </Button>
        ) : null}
      </div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            id={FILTER_PANEL_ID}
            role="region"
            aria-label="Inbox filters"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 flex items-center gap-2.5 overflow-x-auto pb-1.5">
              <Select value={filter} onValueChange={(value) => onFilterChange(value as ReviewFilter)}>
                <SelectTrigger className={cn(INBOX_THEME_CLASSES.filterSelectTrigger, "min-w-[110px]")}>
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
                  <SelectTrigger className={cn(INBOX_THEME_CLASSES.filterSelectTrigger, "min-w-[115px]")}>
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
                  <SelectTrigger className={cn(INBOX_THEME_CLASSES.filterSelectTrigger, "min-w-[125px]")}>
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
                <SelectTrigger className={cn(INBOX_THEME_CLASSES.filterSelectTrigger, "min-w-[98px]")}>
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
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onReset}
                  className={cn("h-auto px-3 py-1.5", INBOX_THEME_CLASSES.filterResetButton)}
                >
                  Reset
                </Button>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <p className="sr-only" role="status" aria-live="polite">
        {activeFiltersCount} active filters.
      </p>
    </section>
  )
}
