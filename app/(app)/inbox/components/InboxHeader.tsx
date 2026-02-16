"use client"

import * as React from "react"
import { motion } from "framer-motion"

import { NotificationCenter } from "@/components/NotificationCenter"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InboxIcon, RefreshCw, Search } from "@/components/icons"
import { INBOX_THEME_CLASSES, inboxSegmentedClass } from "@/lib/design-system/inbox-theme"
import { cn } from "@/lib/utils"

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
  const activeIndex = TAB_OPTIONS.findIndex((o) => o.value === tab)

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="border-b border-slate-200/70 px-3 pb-2.5 pt-3"
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900">Inbox</h1>
          {pendingCount > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#007aff] px-1.5 text-[10px] font-bold tabular-nums text-white">
              {pendingCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <NotificationCenter className="rounded-2xl border-slate-200 bg-white" />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-xl border-slate-200 bg-white transition-colors duration-200 hover:bg-slate-50 hover:text-[#007aff]"
            onClick={onRefresh}
            aria-label="Refresh inbox"
          >
            <RefreshCw className={cn("h-4 w-4 transition-transform duration-500", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="relative mb-2.5">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          type="search"
          placeholder="Search conversations…"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="h-10 rounded-xl border-slate-200/80 bg-[#f2f2f7] pl-10 text-sm font-medium placeholder:text-slate-400 transition-all duration-200 focus:bg-white focus:ring-2 focus:ring-[#007aff]/20 focus:border-[#007aff]/40"
          aria-label="Search inbox reviews"
        />
      </div>

      <div className="relative rounded-xl bg-[#f2f2f7] p-0.5">
        <div className="relative grid grid-cols-3">
          <div
            className="absolute top-0 bottom-0 rounded-[10px] bg-white shadow-sm transition-all duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]"
            style={{
              width: `calc(100% / 3)`,
              left: `calc(${activeIndex} * 100% / 3)`,
            }}
          />
          {TAB_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onTabChange(option.value)}
              className={cn(
                "relative z-10 h-7 rounded-[10px] text-xs font-bold tracking-tight transition-colors duration-200",
                tab === option.value
                  ? "text-[#007aff]"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </motion.header>
  )
}
