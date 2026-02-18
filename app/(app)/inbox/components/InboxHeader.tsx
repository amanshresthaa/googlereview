"use client"

import { motion } from "framer-motion"
import { RefreshCw, Search } from "lucide-react"

import { NotificationCenter } from "@/components/NotificationCenter"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { INBOX_THEME_CLASSES, inboxSegmentedClass } from "@/lib/design-system/inbox-theme"
import { cn } from "@/lib/utils"

export type InboxTab = "pending" | "replied" | "all"

type InboxHeaderProps = {
  pendingCount: number
  tab: InboxTab
  onTabChange: (value: InboxTab) => void
  refreshing: boolean
  search: string
  onSearchChange: (value: string) => void
  onRefresh: () => void
}

const TAB_OPTIONS: Array<{ value: InboxTab; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "replied", label: "Replied" },
  { value: "all", label: "All" },
]

const TABLIST_ID = "inbox-tablist"

export function InboxHeader({
  pendingCount,
  tab,
  onTabChange,
  refreshing,
  search,
  onSearchChange,
  onRefresh,
}: InboxHeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className={INBOX_THEME_CLASSES.headerSection}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="bg-gradient-to-b from-shell-foreground to-shell-foreground/60 bg-clip-text text-3xl font-black tracking-tight text-transparent lg:text-4xl">
            Inbox
          </h1>
          <p className="mt-1 text-sm font-medium text-shell-foreground/45">
            Operational split-view for high-volume review workflows
            {pendingCount > 0 ? <span className="ml-2 text-shell-foreground/60">• {pendingCount} pending</span> : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <NotificationCenter className={INBOX_THEME_CLASSES.iconButton} />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={INBOX_THEME_CLASSES.iconButton}
            onClick={onRefresh}
            aria-label="Refresh inbox"
          >
            <RefreshCw className={cn("h-4 w-4 text-shell-foreground/60", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-shell-foreground/45" />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search reviewer, location, mention, or draft state…"
          className={cn(INBOX_THEME_CLASSES.searchInput, "w-full pl-10")}
          aria-label="Search inbox reviews"
        />
      </div>

      <Tabs value={tab} onValueChange={(value) => onTabChange(value as InboxTab)}>
        <TabsList
          className={cn(INBOX_THEME_CLASSES.segmented, "h-auto w-full justify-start rounded-none bg-transparent p-0")}
          aria-label="Review status tabs"
          id={TABLIST_ID}
        >
          {TAB_OPTIONS.map((option) => (
            <TabsTrigger
              key={option.value}
              value={option.value}
              id={`inbox-tab-${option.value}`}
              aria-controls="inbox-review-list-panel"
              className={cn(
                inboxSegmentedClass(option.value === tab),
                "data-[state=active]:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30",
              )}
            >
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <p className="sr-only" role="status" aria-live="polite">
        {pendingCount} pending reviews.
      </p>
    </motion.header>
  )
}
