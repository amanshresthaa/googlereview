"use client"

import { motion } from "framer-motion"

import { NotificationCenter } from "@/components/NotificationCenter"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RefreshCw, Search, Sparkles } from "lucide-react"
import { INBOX_THEME_CLASSES, inboxSegmentedClass } from "@/lib/design-system/inbox-theme"
import { cn } from "@/lib/utils"

const ICON_STROKE = 2.6

export type InboxTab = "pending" | "replied" | "all"

type InboxHeaderProps = {
  pendingCount: number
  tab: InboxTab
  onTabChange: (value: InboxTab) => void
  search: string
  onSearchChange: (value: string) => void
  refreshing: boolean
  onRefresh: () => void
}

const TAB_OPTIONS: Array<{ value: InboxTab; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "replied", label: "Replied" },
  { value: "all", label: "All" },
]

export function InboxHeader({
  pendingCount,
  tab,
  onTabChange,
  search,
  onSearchChange,
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
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Tahoe Inbox</p>
          <div className="flex items-center gap-2.5">
            <h2 className="truncate text-3xl font-black tracking-[-0.04em] text-slate-900">Reviews</h2>
            {pendingCount > 0 ? (
              <span className="inline-flex min-w-6 items-center justify-center rounded-full border border-white/55 bg-white/75 px-2 py-0.5 text-[10px] font-black tabular-nums text-[#007AFF]">
                {pendingCount}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <NotificationCenter className="h-10 w-10 rounded-2xl border-white/60 bg-white/75 backdrop-blur-xl" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-2xl border border-white/60 bg-white/75 text-slate-600 transition-all duration-300 hover:bg-white hover:text-[#007AFF]"
            onClick={onRefresh}
            aria-label="Refresh inbox"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} strokeWidth={ICON_STROKE} />
          </Button>
        </div>
      </div>

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={ICON_STROKE} />
        <Input
          type="search"
          placeholder="Search reviewer, content, or location"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className={INBOX_THEME_CLASSES.searchInput}
          aria-label="Search inbox reviews"
        />
      </div>

      <div className={INBOX_THEME_CLASSES.segmented}>
        <div className="grid grid-cols-3 gap-1">
          {TAB_OPTIONS.map((option) => (
            <button
              key={option.value}
                type="button"
                onClick={() => onTabChange(option.value)}
                className={cn(inboxSegmentedClass(option.value === tab), "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]/30")}
              >
                {option.label}
              </button>
          ))}
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
        <Sparkles className="h-3.5 w-3.5 text-[#007AFF]" strokeWidth={ICON_STROKE} />
        AI responses adapt to brand tone and reviewer sentiment
      </div>
    </motion.header>
  )
}
