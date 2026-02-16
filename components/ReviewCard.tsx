"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { CheckCircle2, Clock3, RefreshCw, Sparkles, Star } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { INBOX_THEME_CLASSES, inboxStatusClass } from "@/lib/design-system/inbox-theme"
import { formatAge, type ReviewRow } from "@/lib/hooks"
import { cn } from "@/lib/utils"

const ICON_STROKE = 2.6

function Avatar({ name }: { name: string | null }) {
  const initials = (name ?? "A")
    .split(" ")
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/65 bg-white/70 text-[11px] font-black text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.12)] backdrop-blur-xl">
      {initials}
    </div>
  )
}

function StatusBadge({ status }: { status: "pending" | "replied" }) {
  return <span className={inboxStatusClass(status)}>{status === "pending" ? "Waiting" : "Replied"}</span>
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" role="img" aria-label={`${rating} stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={`${rating}-${String(index)}`}
          fill={index < rating ? "currentColor" : "none"}
          strokeWidth={ICON_STROKE}
          className={cn("h-3.5 w-3.5", index < rating ? "text-[#007AFF]" : "text-slate-300")}
        />
      ))}
    </div>
  )
}

export const ReviewCard = React.memo(function ReviewCard({
  reviewId,
  row,
  showCheckbox,
  checked,
  onCheckedChange,
  onOpen,
  selected,
  showQuickApprove,
  onQuickApprove,
  quickApproveLoading,
}: {
  reviewId: string
  row: ReviewRow
  showCheckbox: boolean
  checked: boolean
  onCheckedChange: (reviewId: string, val: boolean) => void
  onOpen: (reviewId: string) => void
  selected: boolean
  showQuickApprove?: boolean
  onQuickApprove?: (reviewId: string) => void
  quickApproveLoading?: boolean
}) {
  const canQuickApprove = row.status === "pending" && row.draftStatus === "READY"
  const isPending = row.status === "pending"

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Review by ${row.reviewer.displayName ?? "Anonymous"}`}
        onClick={() => onOpen(reviewId)}
        className={cn(
          "tahoe-squircle-card group relative w-full cursor-pointer rounded-[30px] border p-3.5 text-left shadow-[0_12px_26px_rgba(15,23,42,0.08)] tahoe-pane-l2 transition-all duration-300 active:scale-[0.97] md:p-4",
          showQuickApprove ? "pr-[5.5rem]" : "",
          selected
            ? "border-white bg-white shadow-sm"
            : "border-white/40 bg-white/10 hover:border-white/65 hover:bg-white/30",
        )}
      >
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {showCheckbox ? (
            <div className="flex items-start pt-0.5">
              <Checkbox
                checked={checked}
                onCheckedChange={(value) => onCheckedChange(reviewId, Boolean(value))}
                onClick={(event) => event.stopPropagation()}
                className="h-4 w-4 rounded-sm border-white/70 bg-white/75"
              />
            </div>
          ) : null}

          <Avatar name={row.reviewer.displayName} />

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {isPending ? <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" /> : null}
              <h3 className="truncate text-[15px] font-black tracking-[-0.02em] text-slate-900">
                {row.reviewer.displayName || "Anonymous"}
              </h3>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">
              {row.location.displayName}
            </p>
          </div>
        </div>

        <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
          {formatAge(row.createTimeIso)}
        </span>
      </div>

      <p className="mb-3 line-clamp-2 text-[13px] font-medium leading-relaxed text-slate-700">
        {row.snippet || "No written comment provided."}
      </p>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StarRow rating={row.starRating} />
          <StatusBadge status={row.status} />
        </div>

        <div className="flex items-center gap-1.5">
          {row.currentDraft && isPending ? (
            <span className={INBOX_THEME_CLASSES.draftBadge}>
              <Sparkles className="h-3 w-3" strokeWidth={ICON_STROKE} />
              Draft
            </span>
          ) : null}
        </div>
      </div>
      </button>

      {showQuickApprove ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!canQuickApprove || quickApproveLoading}
          onClick={() => {
            if (canQuickApprove) {
              onQuickApprove?.(reviewId)
            }
          }}
          className={cn(
            "absolute bottom-3 right-3 inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[10px] font-black uppercase tracking-[0.12em] transition-all duration-300",
            canQuickApprove ? INBOX_THEME_CLASSES.quickApproveEnabled : INBOX_THEME_CLASSES.quickApproveIdle,
            "disabled:opacity-70",
          )}
        >
          {quickApproveLoading ? (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
              <RefreshCw className="h-3 w-3" strokeWidth={ICON_STROKE} />
            </motion.div>
          ) : row.status === "replied" ? (
            <CheckCircle2 className="h-3 w-3" strokeWidth={ICON_STROKE} />
          ) : (
            <Clock3 className="h-3 w-3" strokeWidth={ICON_STROKE} />
          )}
          {canQuickApprove ? "Send" : "View"}
        </Button>
      ) : null}
    </div>
  )
})

ReviewCard.displayName = "ReviewCard"
