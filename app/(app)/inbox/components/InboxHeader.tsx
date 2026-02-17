"use client"

import { motion } from "framer-motion"

import { NotificationCenter } from "@/components/NotificationCenter"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RefreshCw } from "lucide-react"
import { INBOX_THEME_CLASSES, inboxSegmentedClass } from "@/lib/design-system/inbox-theme"
import { cn } from "@/lib/utils"

export type InboxTab = "pending" | "replied" | "all"

type InboxHeaderProps = {
  pendingCount: number
  tab: InboxTab
  onTabChange: (value: InboxTab) => void
  refreshing: boolean
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
  onRefresh,
}: InboxHeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      className={INBOX_THEME_CLASSES.headerSection}
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="bg-gradient-to-b from-shell-foreground to-shell-foreground/60 bg-clip-text text-3xl font-black tracking-tight text-transparent lg:text-4xl">
            Reviews
          </h2>
          <p className="text-sm text-shell-foreground/40 mt-1 font-medium">
            Manage your reputation
            {pendingCount > 0 && (
              <span className="ml-2 text-shell-foreground/60">
                • {pendingCount} pending
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
