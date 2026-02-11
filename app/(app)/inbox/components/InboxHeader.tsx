import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { Filter, InboxIcon, RefreshCw, Search, Sparkles } from "@/components/icons"

type InboxHeaderProps = {
  pendingCount: number
  loading: boolean
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  activeTab: "all" | "pending" | "replied"
  onActiveTabChange: (value: "all" | "pending" | "replied") => void
  activeFiltersCount: number
  onOpenFilters: () => void
  onOpenQuickReply: () => void
  quickReplyDisabled: boolean
  bulkApproveEnabled: boolean
  selectionMode: boolean
  onToggleSelectionMode: () => void
  eligibleBulkCount: number
  onSelectReady: () => void
  onRefresh: () => void
}

export function InboxHeader({
  pendingCount,
  loading,
  searchQuery,
  onSearchQueryChange,
  activeTab,
  onActiveTabChange,
  activeFiltersCount,
  onOpenFilters,
  onOpenQuickReply,
  quickReplyDisabled,
  bulkApproveEnabled,
  selectionMode,
  onToggleSelectionMode,
  eligibleBulkCount,
  onSelectReady,
  onRefresh,
}: InboxHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary p-1.5 text-primary-foreground">
              <InboxIcon className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-semibold sm:text-lg">Review Inbox</h1>
              <p className="text-xs text-muted-foreground">{pendingCount} pending responses</p>
            </div>
          </div>

          <Button variant="outline" size="icon" className="h-8 w-8" onClick={onRefresh}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search reviews..."
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            className="pl-9"
          />
        </div>

        <ToggleGroup
          type="single"
          value={activeTab}
          onValueChange={(value) => {
            if (value === "pending" || value === "replied" || value === "all") {
              onActiveTabChange(value)
            }
          }}
          className="grid w-full grid-cols-3 rounded-lg border bg-muted/30 p-1"
        >
          {(["pending", "replied", "all"] as const).map((tab) => (
            <ToggleGroupItem
              key={tab}
              value={tab}
              className="h-8 rounded-md text-xs font-medium capitalize data-[state=on]:bg-background data-[state=on]:shadow-sm"
            >
              {tab}
            </ToggleGroupItem>
            ))}
          </ToggleGroup>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onOpenFilters} className="h-8">
            <Filter className="mr-1.5 h-3.5 w-3.5" />
            Filters
            {activeFiltersCount > 0 ? (
              <Badge variant="secondary" className="ml-1 rounded-full px-1.5 text-[10px]">
                {activeFiltersCount}
              </Badge>
              ) : null}
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={onOpenQuickReply}
            className="h-8"
            disabled={quickReplyDisabled}
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Quick Reply
          </Button>

          {bulkApproveEnabled ? (
            <>
              <Button
                type="button"
                size="sm"
                variant={selectionMode ? "default" : "outline"}
                className="h-8"
                onClick={onToggleSelectionMode}
              >
                {selectionMode ? "Done selecting" : "Select reviews"}
              </Button>

              {selectionMode ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={onSelectReady}
                  disabled={eligibleBulkCount === 0}
                >
                  Select ready ({eligibleBulkCount})
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </header>
  )
}
