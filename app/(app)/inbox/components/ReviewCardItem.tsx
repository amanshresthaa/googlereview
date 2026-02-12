import { motion } from "framer-motion"
import { initials } from "../model"
import { Stars } from "./Stars"
import { formatAge } from "@/lib/hooks"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
        "group relative flex cursor-pointer flex-col gap-3 rounded-2xl border border-border/50 bg-background p-4 transition-all duration-300",
        selected
          ? "border-primary/30 bg-primary/[0.02] shadow-glow-primary ring-1 ring-primary/10"
          : "hover:border-border hover:bg-muted/20 hover:shadow-sm",
      )}
      aria-label={`Review by ${reviewerName}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border border-border/30 shadow-sm">
            <AvatarFallback className="bg-primary/5 text-[12px] font-black text-primary">
              {initials(reviewerName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-black tracking-tight text-foreground">
              {reviewerName}
            </h3>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
              {formatAge(row.createTimeIso)} ago
            </div>
          </div>
        </div>

        {showCheckbox && (
          <div onClick={(event) => event.stopPropagation()}>
            <Checkbox
              checked={checked}
              onCheckedChange={(value) => onCheckedChange(row.id, Boolean(value))}
              className="h-5 w-5 rounded-lg border-border/50 data-[state=checked]:bg-primary"
            />
          </div>
        )}
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <Stars rating={row.starRating} size="xs" />
          <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">
            <MapPin className="h-3 w-3" />
            <span className="truncate max-w-[120px]">{row.location.displayName}</span>
          </div>
        </div>

        <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground font-medium">
          {row.comment || <span className="italic opacity-50">No comment provided</span>}
        </p>

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            {isReplied ? (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[9px] font-black uppercase tracking-widest">
                <CheckCircle2 className="h-2.5 w-2.5" />
                Replied
              </div>
            ) : isUrgent ? (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-[9px] font-black uppercase tracking-widest">
                <TrendingUp className="h-2.5 w-2.5" />
                Urgent
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted text-muted-foreground/60 text-[9px] font-black uppercase tracking-widest">
                <Clock className="h-2.5 w-2.5" />
                Pending
              </div>
            )}

            {!isReplied && row.draftStatus === "READY" && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest">
                <Zap className="h-2.5 w-2.5 fill-primary" />
                Ready
              </div>
            )}
          </div>

          {canQuickApprove && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 rounded-lg px-3 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 shadow-none transition-all"
              onClick={(event) => {
                event.stopPropagation()
                onQuickApprove(row.id)
              }}
              disabled={quickApproveLoading}
            >
              {quickApproveLoading ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                  <RefreshCw className="h-3 w-3" />
                </motion.div>
              ) : "Approve"}
            </Button>
          )}
        </div>
      </div>
      
      {selected && (
        <div className="absolute left-0 top-4 bottom-4 w-1 rounded-r-full bg-primary shadow-glow-primary" />
      )}
    </article>
  )
}


