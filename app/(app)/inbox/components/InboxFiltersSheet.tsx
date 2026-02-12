import * as React from "react"

import type { ReviewFilter } from "@/lib/hooks"
import type { LocationOption } from "../types"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { Filter } from "@/components/icons"

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
        className={cn(
          "flex flex-col p-0 border-border/50 bg-background/95 backdrop-blur-xl",
          side === "bottom" ? "h-[80vh] rounded-t-[32px] shadow-google-xl" : "h-full w-full sm:max-w-[400px]"
        )}
      >
        <SheetTitle className="sr-only">Inbox Filters</SheetTitle>
        
        <div className="flex items-center justify-between border-b border-border/50 p-6 md:px-8">
          <div>
            <h2 className="text-xl font-black tracking-tight">Filters</h2>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Refine your queue</p>
          </div>
          {side === "bottom" && (
            <div className="h-1.5 w-12 rounded-full bg-muted mx-auto absolute top-3 left-1/2 -translate-x-1/2" />
          )}
        </div>

        <ScrollArea className="flex-1 px-6 py-8 md:px-8">
          <div className="space-y-8">
            <FilterSection label="Active Queue">
              <Select value={baseFilter} onValueChange={(value) => onBaseFilterChange(value as ReviewFilter)}>
                <SelectTrigger className="h-12 rounded-[20px] bg-muted/30 border-none px-5 font-bold focus:ring-0">
                  <SelectValue placeholder="Select queue" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-border/50">
                  {queueOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} disabled={option.disabled} className="rounded-xl py-3 font-bold text-sm">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterSection>

            <FilterSection label="Business Location">
              <Select value={locationFilter} onValueChange={onLocationFilterChange}>
                <SelectTrigger className="h-12 rounded-[20px] bg-muted/30 border-none px-5 font-bold focus:ring-0">
                  <SelectValue placeholder="All locations" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-border/50">
                  <SelectItem value="all" className="rounded-xl py-3 font-bold text-sm">All Locations</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id} className="rounded-xl py-3 font-bold text-sm">
                      {location.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterSection>

            <FilterSection label="Experience Rating">
              <Select value={ratingFilter} onValueChange={onRatingFilterChange}>
                <SelectTrigger className="h-12 rounded-[20px] bg-muted/30 border-none px-5 font-bold focus:ring-0">
                  <SelectValue placeholder="Any rating" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-border/50">
                  <SelectItem value="all" className="rounded-xl py-3 font-bold text-sm">Any Rating</SelectItem>
                  {[5, 4, 3, 2, 1].map((stars) => (
                    <SelectItem key={stars} value={String(stars)} className="rounded-xl py-3 font-bold text-sm">
                      {stars} {stars === 1 ? 'Star' : 'Stars'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterSection>

            {showMentionFilter && (
              <FilterSection label="Keyword Detection">
                <Select value={mentionFilter} onValueChange={onMentionFilterChange}>
                  <SelectTrigger className="h-12 rounded-[20px] bg-muted/30 border-none px-5 font-bold focus:ring-0">
                    <SelectValue placeholder="Pick keyword" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-border/50">
                    {mentionKeywords.map((keyword) => (
                      <SelectItem key={keyword} value={keyword} className="rounded-xl py-3 font-bold text-sm">
                        @{keyword}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterSection>
            )}
          </div>
        </ScrollArea>

        <div className="border-t border-border/50 bg-background/50 p-6 md:p-8">
          <div className="flex items-center justify-between gap-4">
            <Button
              type="button"
              variant="ghost"
              className="h-12 px-6 rounded-2xl font-bold text-muted-foreground hover:bg-muted transition-all"
              onClick={onClearAll}
            >
              Reset All
            </Button>
            <Button
              type="button"
              className="h-12 flex-1 rounded-2xl bg-primary font-black shadow-glow-primary transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98]"
              onClick={() => onOpenChange(false)}
            >
              Apply Selection
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}


function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 px-1">
        {label}
      </label>
      {children}
    </div>
  )
}

