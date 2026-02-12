import { motion, AnimatePresence } from "framer-motion"
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
    <motion.article
      onClick={() => onOpen(row.id)}
      whileTap={{ scale: 0.98 }}
      whileHover={{ scale: 1.01 }}
      className={cn(
        "group relative flex cursor-pointer flex-col gap-3 rounded-2xl border border-border/50 bg-background p-4 transition-all duration-300",
        selected
          ? "border-primary/30 bg-primary/[0.02] shadow-glow-primary ring-1 ring-primary/10"
          : "hover:border-border hover:bg-muted/20 hover:shadow-sm",
      )}
      aria-label={`Review by ${reviewerName}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-10 w-10 border border-border/30 shadow-sm shrink-0">
            <AvatarFallback className={cn("bg-primary/5 text-[12px] font-black text-primary transition-colors", selected && "bg-primary text-primary-foreground")}>
              {initials(reviewerName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-black tracking-tight text-foreground">
              {reviewerName}
            </h3>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
              <Clock className="h-2.5 w-2.5" />
              {formatAge(row.createTimeIso)} ago
            </div>
          </div>
        </div>

        {showCheckbox && (
          <div onClick={(event) => event.stopPropagation()} className="shrink-0">
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
          <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest max-w-[60%]">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{row.location.displayName}</span>
          </div>
        </div>

        <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground font-medium">
          {row.comment || <span className="italic opacity-50">No comment provided</span>}
        </p>

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <AnimatePresence mode="wait">
              {isReplied ? (
                <motion.div
                  key="replied"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[9px] font-black uppercase tracking-widest"
                >
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  Replied
                </motion.div>
              ) : isUrgent ? (
                <motion.div
                  key="urgent"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-[9px] font-black uppercase tracking-widest"
                >
                  <TrendingUp className="h-2.5 w-2.5" />
                  Urgent
                </motion.div>
              ) : (
                <motion.div
                  key="pending"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted text-muted-foreground/60 text-[9px] font-black uppercase tracking-widest"
                >
                  <Clock className="h-2.5 w-2.5" />
                  Pending
                </motion.div>
              )}
            </AnimatePresence>

            {!isReplied && row.draftStatus === "READY" && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest"
              >
                <Zap className="h-2.5 w-2.5 fill-primary" />
                Ready
              </motion.div>
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
        <motion.div
          layoutId="active-indicator"
          className="absolute left-0 top-4 bottom-4 w-1 rounded-r-full bg-primary shadow-glow-primary"
        />
      )}
    </motion.article>
  )
}



