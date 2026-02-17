"use client"

import * as React from "react"
import {
  CheckCircle2,
  CornerDownRight,
  Loader2,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  ThumbsUp,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { formatAge, type ReviewRow } from "@/lib/hooks"
import { cn } from "@/lib/utils"

type ReviewBadgeVariant = "default" | "ai" | "success" | "warning"
const REVIEW_BADGE_CLASSNAMES: Record<ReviewBadgeVariant, string> = {
  default: "border-shell-foreground/10 bg-shell-foreground/5 text-shell-foreground/40",
  ai: "border-brand/20 bg-brand/10 text-brand-muted",
  success: "border-success/20 bg-success/10 text-success-soft",
  warning: "border-warning/20 bg-warning/10 text-warning-soft",
}

function draftStatusLabel(status: ReviewRow["draftStatus"] | null) {
  if (status === "READY") return "AI Draft Ready"
  if (status === "NEEDS_APPROVAL") return "Review Required"
  if (status === "BLOCKED_BY_VERIFIER") return "Needs Edits"
  if (status === "POSTED") return "Posted"
  if (status === "POST_FAILED") return "Post Failed"
  return "Not Started"
}

function draftStatusVariant(status: ReviewRow["draftStatus"] | null): ReviewBadgeVariant {
  if (status === "READY" || status === "NEEDS_APPROVAL") return "ai"
  if (status === "POSTED") return "success"
  if (status === "BLOCKED_BY_VERIFIER" || status === "POST_FAILED") return "warning"
  return "default"
}

function reviewBadgeClass(variant: ReviewBadgeVariant) {
  return cn(
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
    REVIEW_BADGE_CLASSNAMES[variant],
  )
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={`${rating}-${String(index)}`}
          className={cn(
            "h-3.5 w-3.5 transition-colors",
            index < rating ? "fill-warning-soft text-warning-soft" : "fill-shell-foreground/5 text-shell-foreground/10",
          )}
        />
      ))}
    </div>
  )
}

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
  onGenerateDraft?: (reviewId: string) => Promise<void>
  onSaveDraft?: (reviewId: string, text: string, options?: { silent?: boolean }) => Promise<void>
  onVerifyDraft?: (reviewId: string) => Promise<void>
  onPublishReply?: (reviewId: string, text: string, row: ReviewRow) => Promise<void>
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
  onGenerateDraft,
  onSaveDraft,
  onVerifyDraft,
  onPublishReply,
}: ReviewCardProps) {
  const reviewText = row.comment.trim() || row.snippet.trim()
  const createdAge = formatAge(row.createTimeIso)
  const draftStatus = row.currentDraft?.status ?? row.draftStatus
  const hasReply = Boolean(row.reply.comment?.trim())
  const canQuickApprove = row.status === "pending" && row.draftStatus === "READY"
  const showDraftCta = draftStatus === "READY"

  const [isReplying, setIsReplying] = React.useState(false)
  const [draftInput, setDraftInput] = React.useState(row.currentDraft?.text ?? "")
  const [busy, setBusy] = React.useState<"generate" | "verify" | "publish" | null>(null)
  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved">("idle")
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveFeedbackTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPersistedRef = React.useRef(row.currentDraft?.text ?? "")

  React.useEffect(() => {
    const nextDraft = row.currentDraft?.text ?? ""
    setDraftInput(nextDraft)
    lastPersistedRef.current = nextDraft
    setSaveState("idle")
  }, [row.id, row.currentDraft?.text])

  React.useEffect(() => {
    if (!isReplying || !onSaveDraft) return
    if (busy !== null) return

    const trimmed = draftInput.trim()
    const lastPersisted = lastPersistedRef.current.trim()
    if (!trimmed || trimmed === lastPersisted) return

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      setSaveState("saving")
      void onSaveDraft(reviewId, draftInput, { silent: true })
        .then(() => {
          lastPersistedRef.current = draftInput
          setSaveState("saved")
          if (saveFeedbackTimerRef.current) clearTimeout(saveFeedbackTimerRef.current)
          saveFeedbackTimerRef.current = setTimeout(() => {
            setSaveState("idle")
          }, 1400)
        })
        .catch(() => {
          setSaveState("idle")
        })
    }, 900)

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
    }
  }, [busy, draftInput, isReplying, onSaveDraft, reviewId])

  React.useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (saveFeedbackTimerRef.current) clearTimeout(saveFeedbackTimerRef.current)
    }
  }, [])

  const runAction = React.useCallback(async (action: "generate" | "verify" | "publish", work: () => Promise<void>) => {
    setBusy(action)
    try {
      await work()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed")
    } finally {
      setBusy(null)
    }
  }, [])

  const openReplyEditor = React.useCallback(() => {
    setIsReplying(true)
    onOpen(reviewId)
  }, [onOpen, reviewId])

  const handleQuickAction = React.useCallback(() => {
    if (canQuickApprove) {
      onQuickApprove?.(reviewId)
      return
    }
    onOpen(reviewId)
  }, [canQuickApprove, onOpen, onQuickApprove, reviewId])

  const hasDraftInput = draftInput.trim().length > 0

  const initials = (row.reviewer.displayName ?? "A")
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <article
      className={cn(
        "group relative flex flex-col gap-4 rounded-3xl border p-4 transition-all duration-300 sm:p-5",
        "border-shell-foreground/5 bg-shell-foreground/5 backdrop-blur-md",
        "hover:border-shell-foreground/10 hover:bg-shell-foreground/5",
        selected ? "border-brand/30 bg-shell-foreground/10 ring-2 ring-brand/50" : "shadow-xl shadow-shell/20",
      )}
    >
      <div className="flex items-start justify-between gap-3 sm:gap-4">
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpen(reviewId)}
          className="h-auto min-w-0 flex-1 justify-start gap-3 rounded-none p-0 text-left hover:bg-transparent"
          aria-label={`Open review by ${row.reviewer.displayName ?? "Anonymous"}`}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-shell-foreground/5 bg-gradient-to-br from-muted to-card text-sm font-bold text-shell-foreground/80 shadow-inner transition-transform group-hover:scale-105 sm:h-11 sm:w-11">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-shell-foreground/90">{row.reviewer.displayName ?? "Anonymous User"}</h3>
              {row.reviewer.isAnonymous ? <Badge className={reviewBadgeClass("default")}>Anon</Badge> : null}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-shell-foreground/30">
              <span>{createdAge} ago</span>
              <span className="h-0.5 w-0.5 rounded-full bg-shell-foreground/20" />
              <span className="flex min-w-0 items-center gap-1">
                <MapPin className="h-2.5 w-2.5" />
                <span className="truncate">{row.location.displayName}</span>
              </span>
            </div>
          </div>
        </Button>

        <div className="flex shrink-0 items-center gap-1">
          {showCheckbox ? (
            <Checkbox
              checked={checked}
              onCheckedChange={(value) => onCheckedChange(reviewId, Boolean(value))}
              className="h-4 w-4 border-shell-foreground/20"
            />
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onOpen(reviewId)}
            className="h-8 w-8 rounded-lg text-shell-foreground/30 transition-all hover:bg-shell-foreground/5 hover:text-shell-foreground"
            aria-label={`More actions for ${row.reviewer.displayName ?? "anonymous reviewer"}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <StarRating rating={row.starRating} />
        <p className="text-[13px] font-medium leading-relaxed text-shell-foreground/70 sm:text-[14px]">
          {reviewText ? (
            reviewText
          ) : (
            <span className="text-xs font-normal italic text-shell-foreground/20">No written content provided</span>
          )}
        </p>
      </div>

      {!isReplying && !hasReply ? (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={openReplyEditor}
              className="group/btn h-auto gap-2 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-brand-foreground shadow-lg shadow-brand/20 transition-all hover:bg-brand-soft active:scale-95"
            >
              <MessageSquare className="h-3.5 w-3.5 transition-transform group-hover/btn:-translate-y-0.5" />
              Reply
            </Button>

            {showDraftCta ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={openReplyEditor}
                className="h-auto rounded-xl border-brand/20 bg-brand/10 px-4 py-2 text-xs font-bold text-brand-muted transition-all hover:bg-brand/20"
              >
                <Sparkles className="h-3.5 w-3.5 text-brand-muted" />
                Review AI Draft
              </Button>
            ) : draftStatus ? (
              <Badge className={reviewBadgeClass(draftStatusVariant(draftStatus))}>
                <Sparkles className="h-3 w-3" />
                {draftStatusLabel(draftStatus)}
              </Badge>
            ) : null}
          </div>

          {showQuickApprove ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={quickApproveLoading}
              onClick={handleQuickAction}
              className={cn(
                "h-9 w-9 rounded-xl border bg-shell-foreground/5 transition-all",
                canQuickApprove
                  ? "border-brand/25 text-brand-muted hover:bg-brand/20 hover:text-brand/80"
                  : "border-shell-foreground/5 text-shell-foreground/20 hover:bg-shell-foreground/10 hover:text-shell-foreground/60",
                quickApproveLoading && "opacity-60",
              )}
              aria-label={canQuickApprove ? "Quick approve review reply" : "Open review details"}
            >
              {quickApproveLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5" />}
            </Button>
          ) : null}
        </div>
      ) : null}

      {hasReply && row.reply.comment ? (
        <div className="relative mt-1 overflow-hidden rounded-2xl border border-shell-foreground/5 bg-shell-foreground/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-brand/20 text-brand-muted">
              <CornerDownRight className="h-3 w-3" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-shell-foreground/40">Our Response</span>
            <div className="ml-auto">
              <Badge className={reviewBadgeClass("success")}>
                <CheckCircle2 className="h-3 w-3" />
                Posted
              </Badge>
            </div>
          </div>
          <p className="text-[13px] italic leading-relaxed text-shell-foreground/50">&ldquo;{row.reply.comment}&rdquo;</p>
        </div>
      ) : null}

      {isReplying ? (
        <div className="mt-1 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="group/textarea relative overflow-hidden rounded-2xl border border-shell-foreground/10 bg-shell/40 shadow-inner transition-colors focus-within:border-brand/50">
            <Textarea
              autoFocus
              value={draftInput}
              onChange={(event) => setDraftInput(event.target.value)}
              placeholder="Write your public reply..."
              className="min-h-[140px] w-full resize-none border-0 bg-transparent p-4 text-sm text-shell-foreground placeholder:text-shell-foreground/20 shadow-none focus-visible:ring-0"
            />

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-shell-foreground/5 bg-shell-foreground/[0.02] px-3 py-2">
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (!onGenerateDraft) return
                    void runAction("generate", async () => {
                      await onGenerateDraft(reviewId)
                    })
                  }}
                  disabled={busy === "generate" || !onGenerateDraft}
                  className="h-auto gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-bold text-shell-foreground/40 transition-all hover:bg-shell-foreground/5 hover:text-shell-foreground/80 disabled:opacity-50"
                >
                  {busy === "generate" ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-brand-muted" />}
                  Regenerate
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (!onVerifyDraft) return
                    void runAction("verify", async () => {
                      await onVerifyDraft(reviewId)
                    })
                  }}
                  disabled={busy === "verify" || !hasDraftInput || !onVerifyDraft}
                  className="h-auto gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-bold text-shell-foreground/40 transition-all hover:bg-shell-foreground/5 hover:text-shell-foreground/80 disabled:opacity-50"
                >
                  {busy === "verify" ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                  Verify Quality
                </Button>
              </div>

              <div className="text-[10px] italic text-shell-foreground/20">
                {saveState === "saving" ? "Syncing..." : "Changes saved locally"}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsReplying(false)}
              className="h-auto gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-shell-foreground/40 transition-all hover:bg-shell-foreground/5 hover:text-shell-foreground/80"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>

            <div className="ml-auto w-full sm:w-auto">
              <Button
                type="button"
                onClick={() => {
                  if (!onPublishReply) return
                  void runAction("publish", async () => {
                    await onPublishReply(reviewId, draftInput, row)
                  })
                }}
                disabled={busy === "publish" || !hasDraftInput || !onPublishReply}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-xs font-bold text-background shadow-lg shadow-shell-foreground/5 transition-all hover:bg-foreground/90 active:scale-95 disabled:opacity-50 sm:w-auto"
              >
                {busy === "publish" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Publish Reply
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  )
})

ReviewCard.displayName = "ReviewCard"
