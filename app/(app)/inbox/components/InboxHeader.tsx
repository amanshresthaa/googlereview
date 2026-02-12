import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Filter, InboxIcon, RefreshCw, Search, Sparkles, CheckCircle2 } from "@/components/icons"

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
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-xl">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <InboxIcon className="h-4 w-4" />
            </div>
            <h1 className="text-xl font-black tracking-tight">Inbox</h1>
            <AnimatePresence>
              {pendingCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <Badge variant="default" className="h-5 px-2 rounded-full text-[10px] font-black bg-primary/10 text-primary border-none shadow-none">
                    {pendingCount}
                  </Badge>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-1">
            <TooltipProvider delayDuration={400}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={onRefresh}
                  >
                    {loading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </motion.div>
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="font-bold">Sync Reviews</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onOpenQuickReply}
                    className="h-9 w-9 rounded-xl text-primary hover:bg-primary/5"
                    disabled={quickReplyDisabled}
                  >
                    <Sparkles className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="font-bold">Quick Reply Mode</TooltipContent>
              </Tooltip>

              {bulkApproveEnabled && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant={selectionMode ? "default" : "ghost"}
                      size="icon"
                      className={cn(
                        "h-9 w-9 rounded-xl transition-all",
                        selectionMode ? "bg-primary shadow-glow-primary" : "text-muted-foreground hover:bg-muted"
                      )}
                      onClick={onToggleSelectionMode}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="font-bold">Bulk Selection</TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
            <Input
              type="text"
              placeholder="Filter reviews..."
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              className="h-10 rounded-2xl border-none bg-muted/40 pl-9 pr-4 text-sm font-medium focus:bg-muted/60 focus:ring-0 transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <ToggleGroup
              type="single"
              value={activeTab}
              onValueChange={(value) => {
                if (value === "pending" || value === "replied" || value === "all") {
                  onActiveTabChange(value)
                }
              }}
              className="flex h-10 rounded-2xl bg-muted/40 p-1 flex-1 sm:flex-initial"
            >
              {(["pending", "replied", "all"] as const).map((tab) => (
                <ToggleGroupItem
                  key={tab}
                  value={tab}
                  className="h-8 rounded-xl px-4 text-[10px] font-black uppercase tracking-widest transition-all data-[state=on]:bg-background data-[state=on]:text-primary data-[state=on]:shadow-sm flex-1 sm:flex-initial"
                >
                  {tab}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            <TooltipProvider delayDuration={400}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={onOpenFilters}
                    className="h-10 w-10 shrink-0 rounded-2xl border-none bg-muted/40 hover:bg-muted/60 relative"
                  >
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <AnimatePresence>
                      {activeFiltersCount > 0 && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.5 }}
                          className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[9px] font-black text-white flex items-center justify-center shadow-sm"
                        >
                          {activeFiltersCount}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="font-bold">Advanced Filters</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <AnimatePresence>
          {selectionMode && eligibleBulkCount > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: "auto", marginTop: 12 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="overflow-hidden"
            >
              <Button
                type="button"
                variant="outline"
                className="w-full h-10 rounded-2xl border-primary/20 bg-primary/5 text-primary text-xs font-black uppercase tracking-widest hover:bg-primary/10 transition-all"
                onClick={onSelectReady}
              >
                Select {eligibleBulkCount} Ready for Approval
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  )
}




