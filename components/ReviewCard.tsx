"use client"

import * as React from "react"
import { ArrowRight, Clock3, MapPin, Sparkles, Star, ThumbsUp } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { formatAge, type ReviewRow } from "@/lib/hooks"
import { cn } from "@/lib/utils"

type ReviewCardProps = {
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
}

function draftLabel(status: ReviewRow["draftStatus"] | null) {
  if (status === "READY") return "Ready"
  if (status === "NEEDS_APPROVAL") return "Needs Approval"
  if (status === "BLOCKED_BY_VERIFIER") return "Blocked"
  if (status === "POSTED") return "Posted"
  if (status === "POST_FAILED") return "Post Failed"
  return "No Draft"
}

function statusBadgeClass(status: ReviewRow["status"]) {
  return status === "pending"
    ? "border-warning/30 bg-warning/10 text-warning-soft"
    : "border-success/30 bg-success/10 text-success-soft"
}

function draftBadgeClass(status: ReviewRow["draftStatus"] | null) {
  if (status === "READY") return "border-success/30 bg-success/10 text-success-soft"
  if (status === "BLOCKED_BY_VERIFIER" || status === "POST_FAILED") return "border-warning/30 bg-warning/10 text-warning-soft"
  if (status === "POSTED") return "border-brand/30 bg-brand/15 text-brand-muted"
  return "border-shell-foreground/20 bg-shell-foreground/10 text-shell-foreground/60"
}

function StarStrip({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-hidden>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={`${rating}-${String(index)}`}
          className={cn(
            "h-3.5 w-3.5",
            index < rating ? "fill-star text-star" : "fill-shell-foreground/10 text-shell-foreground/20",
          )}
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
}: ReviewCardProps) {
  const reviewerName = row.reviewer.displayName ?? "Anonymous reviewer"
  const reviewText = row.comment.trim() || row.snippet.trim() || "No written review content provided."
  const canQuickApprove = row.status === "pending" && row.draftStatus === "READY"

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border p-3 motion-all motion-standard",
        "border-shell-foreground/10 bg-shell-foreground/[0.04]",
        "hover:border-shell-foreground/20 hover:bg-shell-foreground/[0.08]",
        selected ? "border-brand/35 bg-shell-foreground/[0.11] shadow-glow-primary" : "shadow-floating",
      )}
      style={{ contentVisibility: "auto", containIntrinsicSize: "180px" }}
    >
      <div className="flex items-start gap-2.5">
        {showCheckbox ? (
          <div className="pt-0.5">
            <Checkbox
              checked={checked}
              onCheckedChange={(value) => onCheckedChange(reviewId, Boolean(value))}
              className="h-4 w-4 border-shell-foreground/25"
            />
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => onOpen(reviewId)}
          className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          aria-label={`Open review by ${reviewerName}`}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate text-sm font-black tracking-tight text-shell-foreground/95">{reviewerName}</h3>
            <Badge className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", statusBadgeClass(row.status))}>
              {row.status}
            </Badge>
            <Badge className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", draftBadgeClass(row.draftStatus))}>
              <Sparkles className="mr-1 h-3 w-3" />
              {draftLabel(row.draftStatus)}
            </Badge>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-shell-foreground/50">
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3 w-3" />
              {formatAge(row.createTimeIso)} ago
            </span>
            <span className="h-1 w-1 rounded-full bg-shell-foreground/25" />
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{row.location.displayName}</span>
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="min-w-0 flex-1 truncate text-xs text-shell-foreground/78">{reviewText}</p>
            <StarStrip rating={row.starRating} />
          </div>
        </button>

        <div className="flex flex-col items-end gap-1.5">
          {showQuickApprove ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={quickApproveLoading}
              onClick={() => {
                if (canQuickApprove) {
                  onQuickApprove?.(reviewId)
                  return
                }
                onOpen(reviewId)
              }}
              className={cn(
                "h-8 w-8 rounded-xl border",
                canQuickApprove
                  ? "border-brand/30 bg-brand/10 text-brand-muted hover:bg-brand/20"
                  : "border-shell-foreground/12 bg-shell-foreground/6 text-shell-foreground/55",
              )}
              aria-label={canQuickApprove ? "Quick approve and publish" : "Open review workspace"}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </Button>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onOpen(reviewId)}
            className="h-8 w-8 rounded-xl border border-shell-foreground/12 bg-shell-foreground/6 text-shell-foreground/55 hover:text-shell-foreground/90"
            aria-label="Open review details"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </article>
  )
})

ReviewCard.displayName = "ReviewCard"
