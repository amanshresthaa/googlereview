"use client"

import * as React from "react"
import { motion } from "framer-motion"

import { formatAge, type ReviewRow } from "@/lib/hooks"
import { INBOX_THEME_CLASSES, inboxStatusClass } from "@/lib/design-system/inbox-theme"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Clock, RefreshCw, Sparkles, Star } from "@/components/icons"

function Avatar({ name }: { name: string | null }) {
  const initial = (name ?? "A").charAt(0).toUpperCase()
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
      {initial}
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
          weight={index < rating ? "fill" : "regular"}
          className={cn("h-3 w-3", index < rating ? "text-[#007aff]" : "text-slate-300")}
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
    <article
      aria-label={`Review by ${row.reviewer.displayName ?? "Anonymous"}`}
      onClick={() => onOpen(reviewId)}
      className={cn(
        "group relative cursor-pointer rounded-2xl p-3 transition-all duration-200",
        "hover:scale-[1.01] active:scale-[0.99]",
        selected
          ? "border-l-[3px] border-l-[#007aff] bg-[#eef3ff] shadow-[inset_0_0_0_1px_rgba(0,122,255,0.12)]"
          : "border-l-[3px] border-l-transparent bg-white hover:bg-slate-50/80",
      )}
    >
      <div className="flex gap-3">
        {showCheckbox ? (
          <div className="flex items-start pt-0.5">
            <Checkbox
              checked={checked}
              onCheckedChange={(value) => onCheckedChange(reviewId, Boolean(value))}
              onClick={(event) => event.stopPropagation()}
              className="h-4 w-4 rounded-sm border-slate-300"
            />
          </div>
        ) : null}

        <Avatar name={row.reviewer.displayName} />

        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 truncate">
              {isPending ? (
                <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#007aff]" />
              ) : null}
              <h3 className="truncate text-[14px] font-bold tracking-tight text-slate-900">
                {row.reviewer.displayName || "Anonymous"}
              </h3>
            </div>
            <span className="shrink-0 text-[10px] font-medium text-slate-400">
              {formatAge(row.createTimeIso)}
            </span>
          </div>

          <p className="mb-1.5 line-clamp-2 text-[13px] leading-snug text-slate-500">
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
                  <Sparkles className="h-3 w-3" />
                  Draft
                </span>
              ) : null}

              {showQuickApprove ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!canQuickApprove || quickApproveLoading}
                  onClick={(event) => {
                    event.stopPropagation()
                    if (canQuickApprove) {
                      onQuickApprove?.(reviewId)
                    }
                  }}
                  className={cn(
                    "inline-flex h-6 items-center gap-1 rounded-full px-2 text-[10px] font-bold transition-colors",
                    canQuickApprove ? INBOX_THEME_CLASSES.quickApproveEnabled : INBOX_THEME_CLASSES.quickApproveIdle,
                    "disabled:opacity-60",
                  )}
                >
                  {quickApproveLoading ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                      <RefreshCw className="h-3 w-3" />
                    </motion.div>
                  ) : row.status === "replied" ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <Clock className="h-3 w-3" />
                  )}
                  {canQuickApprove ? "Send" : "View"}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </article>
  )
})

ReviewCard.displayName = "ReviewCard"
