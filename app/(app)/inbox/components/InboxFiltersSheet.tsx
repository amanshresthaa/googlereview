import * as React from "react"

import type { ReviewFilter } from "@/lib/hooks"
import type { LocationOption } from "../types"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { X } from "@/components/icons"

type QueueOption = {
  value: ReviewFilter
  label: string
  disabled?: boolean
}

type InboxFiltersSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  side: "right" | "bottom"
  queueOptions: QueueOption[]
  baseFilter: ReviewFilter
  onBaseFilterChange: (value: ReviewFilter) => void
  locationFilter: string
  onLocationFilterChange: (value: string) => void
  locations: LocationOption[]
  ratingFilter: string
  onRatingFilterChange: (value: string) => void
  showMentionFilter: boolean
  mentionFilter: string
  onMentionFilterChange: (value: string) => void
  mentionKeywords: string[]
  onClearAll: () => void
}

export function InboxFiltersSheet({
  open,
  onOpenChange,
  side,
  queueOptions,
  baseFilter,
  onBaseFilterChange,
  locationFilter,
  onLocationFilterChange,
  locations,
  ratingFilter,
  onRatingFilterChange,
  showMentionFilter,
  mentionFilter,
  onMentionFilterChange,
  mentionKeywords,
  onClearAll,
}: InboxFiltersSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn("p-0", side === "bottom" ? "h-[84vh] rounded-t-2xl" : "h-full w-[360px] sm:max-w-[360px]")}
      >
        <SheetTitle className="sr-only">Inbox filters</SheetTitle>
        <div className="flex h-full flex-col">
          <div className="border-b p-4">
            <h2 className="text-base font-semibold">Advanced Filters</h2>
            <p className="text-sm text-muted-foreground">Refine the review queue shown in inbox.</p>
          </div>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Queue</label>
                <Select value={baseFilter} onValueChange={(value) => onBaseFilterChange(value as ReviewFilter)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Queue" />
                  </SelectTrigger>
                  <SelectContent>
                    {queueOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Location</label>
                <Select value={locationFilter} onValueChange={onLocationFilterChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="All locations" />
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
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Rating</label>
                <Select value={ratingFilter} onValueChange={onRatingFilterChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any rating</SelectItem>
                    <SelectItem value="5">5 stars</SelectItem>
                    <SelectItem value="4">4 stars</SelectItem>
                    <SelectItem value="3">3 stars</SelectItem>
                    <SelectItem value="2">2 stars</SelectItem>
                    <SelectItem value="1">1 star</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {showMentionFilter ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Mention keyword</label>
                  <Select value={mentionFilter} onValueChange={onMentionFilterChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Keyword" />
                    </SelectTrigger>
                    <SelectContent>
                      {mentionKeywords.map((keyword) => (
                        <SelectItem key={keyword} value={keyword}>
                          @{keyword}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
          </ScrollArea>

          <div className="border-t p-4">
            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="ghost" onClick={onClearAll}>
                <X className="mr-1.5 h-4 w-4" />
                Clear filters
              </Button>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
