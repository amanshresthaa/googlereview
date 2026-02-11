import * as React from "react"

import { initials } from "../model"
import { Stars } from "./Stars"
import { formatAge } from "@/lib/hooks"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { CheckCircle2, Clock, MapPin, RefreshCw, TrendingUp, Zap } from "@/components/icons"

import type { ReviewRow } from "@/lib/hooks"

type ReviewCardItemProps = {
  row: ReviewRow
  selected: boolean
  checked: boolean
  showCheckbox: boolean
  quickApproveLoading: boolean
  onOpen: (reviewId: string) => void
  onCheckedChange: (reviewId: string, val: boolean) => void
  onQuickApprove: (reviewId: string) => void
}

export function ReviewCardItem({
  row,
  selected,
  checked,
  showCheckbox,
  quickApproveLoading,
  onOpen,
  onCheckedChange,
  onQuickApprove,
}: ReviewCardItemProps) {
  const reviewerName = row.reviewer.displayName || "Anonymous"
  const isReplied = row.status === "replied"
  const isUrgent = row.starRating <= 2 && !isReplied
  const canQuickApprove = !isReplied && row.currentDraft?.text?.trim() && row.draftStatus === "READY"

  return (
    <article
      onClick={() => onOpen(row.id)}
      className={cn(
        "group relative cursor-pointer rounded-xl border border-border bg-card p-3 transition-colors sm:p-4",
        selected ? "border-primary bg-primary/5" : "hover:bg-muted/40",
      )}
      aria-label={`Review by ${reviewerName}`}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 border border-border/70 sm:h-11 sm:w-11">
          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
            {initials(reviewerName)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-0.5">
              <h3 className="truncate text-sm font-semibold text-foreground">{reviewerName}</h3>
              <p className="text-xs text-muted-foreground">{formatAge(row.createTimeIso)} ago</p>
            </div>

            {showCheckbox ? (
              <div onClick={(event) => event.stopPropagation()}>
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) => onCheckedChange(row.id, Boolean(value))}
                  aria-label={`Select review from ${reviewerName}`}
                />
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Stars rating={row.starRating} size="xs" />
            <span className="inline-flex items-center gap-1 truncate">
              <MapPin className="h-3.5 w-3.5" />
              {row.location.displayName}
            </span>
          </div>

          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {row.comment || "No written comment provided."}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-2">
            {isReplied ? (
              <Badge variant="secondary" className="rounded-full">
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                Replied
              </Badge>
            ) : isUrgent ? (
              <Badge variant="destructive" className="rounded-full">
                <TrendingUp className="mr-1 h-3.5 w-3.5" />
                Urgent
              </Badge>
            ) : (
              <Badge variant="outline" className="rounded-full">
                <Clock className="mr-1 h-3.5 w-3.5" />
                Pending
              </Badge>
            )}

            {canQuickApprove ? (
              <Button
                size="sm"
                className="h-7 rounded-full px-3 text-xs"
                onClick={(event) => {
                  event.stopPropagation()
                  onQuickApprove(row.id)
                }}
                disabled={quickApproveLoading}
              >
                {quickApproveLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "Quick approve"}
              </Button>
            ) : row.draftStatus === "READY" && !isReplied ? (
              <Badge variant="outline" className="rounded-full text-xs">
                <Zap className="mr-1 h-3.5 w-3.5" />
                Draft ready
              </Badge>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}
