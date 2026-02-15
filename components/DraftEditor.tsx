"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { useReviewMutations } from "@/app/(app)/inbox/hooks/useReviewMutations"
import { cn } from "@/lib/utils"
import { type ReviewDetail, type ReviewRow } from "@/lib/hooks"
<<<<<<< ours
<<<<<<< ours
import type { DraftStatus } from "@/lib/reviews/types"
=======
import { mapReviewDetailToRow } from "@/lib/reviews/detail-to-row"
>>>>>>> theirs
=======
import { mapReviewDetailToRow } from "@/lib/reviews/detail-to-row"
>>>>>>> theirs
import { getFirstVerifierIssueMessage } from "@/lib/reviews/verifier-result"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  AlertTriangle,
  Copy,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "@/components/icons"

const DRAFT_STATUS_VALUES: DraftStatus[] = [
  "NEEDS_APPROVAL",
  "BLOCKED_BY_VERIFIER",
  "READY",
  "POSTED",
  "POST_FAILED",
]

function toDraftStatus(status: string): DraftStatus {
  if (DRAFT_STATUS_VALUES.includes(status as DraftStatus)) {
    return status as DraftStatus
  }
  return "NEEDS_APPROVAL"
}

function mapDetailToReviewRow(review: ReviewDetail): ReviewRow {
  const draftStatus = review.currentDraft ? toDraftStatus(review.currentDraft.status) : null
  const draftUpdatedAt = review.currentDraft?.updatedAt ?? review.updateTime

  return {
    id: review.id,
    starRating: review.starRating,
    snippet: (review.comment ?? "").slice(0, 120),
    comment: review.comment ?? "",
    reviewer: {
      displayName: review.reviewer.displayName,
      isAnonymous: review.reviewer.isAnonymous,
    },
    location: {
      id: review.location.id,
      displayName: review.location.name,
    },
    createTimeIso: review.createTime,
    unanswered: review.reply.comment == null,
    status: review.reply.comment == null ? "pending" : "replied",
    reply: {
      comment: review.reply.comment,
      updateTimeIso: review.reply.updateTime,
    },
    currentDraft: review.currentDraft
      ? {
          id: review.currentDraft.id,
          text: review.currentDraft.text,
          status: draftStatus ?? "NEEDS_APPROVAL",
          version: review.currentDraft.version,
          updatedAtIso: draftUpdatedAt,
        }
      : null,
    draftStatus,
    mentions: review.mentions,
  }
}

type Props = {
  reviewId: string
  review: ReviewDetail
  refresh: () => void
}

export function DraftEditor({ reviewId, review, refresh }: Props) {
  const [draftRow, setDraftRow] = React.useState<ReviewRow>(() => mapReviewDetailToRow(review))
  const draft = draftRow.currentDraft
  const [text, setText] = React.useState(draft?.text ?? "")
  const [busy, setBusy] = React.useState<false | "generate" | "save" | "verify" | "publish">(false)
  const [tone, setTone] = React.useState("professional")

  React.useEffect(() => {
    const incoming = mapReviewDetailToRow(review)
    setDraftRow((current) => {
      if (current.id !== incoming.id) return incoming

      const currentDraftVersion = current.currentDraft?.version ?? 0
      const incomingDraftVersion = incoming.currentDraft?.version ?? 0
      if (incomingDraftVersion < currentDraftVersion) return current

      const currentDraftUpdatedAt = current.currentDraft?.updatedAtIso ?? null
      const incomingDraftUpdatedAt = incoming.currentDraft?.updatedAtIso ?? null
      if (
        incomingDraftVersion === currentDraftVersion &&
        currentDraftUpdatedAt &&
        incomingDraftUpdatedAt &&
        incomingDraftUpdatedAt < currentDraftUpdatedAt
      ) {
        return current
      }

      const currentReplyUpdatedAt = current.reply.updateTimeIso ?? null
      const incomingReplyUpdatedAt = incoming.reply.updateTimeIso ?? null
      if (current.reply.comment && !incoming.reply.comment) return current
      if (
        current.reply.comment &&
        incoming.reply.comment &&
        currentReplyUpdatedAt &&
        incomingReplyUpdatedAt &&
        incomingReplyUpdatedAt < currentReplyUpdatedAt
      ) {
        return current
      }

      return incoming
    })
  }, [review])

  React.useEffect(() => {
    setText(draft?.text ?? "")
  }, [draft?.id, draft?.text])

  const isDirty = text !== (draft?.text ?? "")
  const hasText = text.trim().length > 0
  const isReplied = Boolean(draftRow.reply.comment)
  const isBlocked = draft?.status === "BLOCKED_BY_VERIFIER"
  const verifierIssue = getFirstVerifierIssueMessage(draft?.verifierResultJson ?? null)
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length
  const [draftRow, setDraftRow] = React.useState<ReviewRow>(() => mapDetailToReviewRow(review))

<<<<<<< ours
<<<<<<< ours
  React.useEffect(() => {
    setDraftRow(mapDetailToReviewRow(review))
  }, [review])

  const rows = React.useMemo(() => [draftRow], [draftRow])
  const updateRow = React.useCallback((id: string, updater: (row: ReviewRow) => ReviewRow) => {
    setDraftRow((current) => (current.id === id ? updater(current) : current))
  }, [])

=======
  const rows = React.useMemo(() => [draftRow], [draftRow])
  const updateRow = React.useCallback((id: string, updater: (row: ReviewRow) => ReviewRow) => {
    setDraftRow((current) => (current.id === id ? updater(current) : current))
  }, [])

>>>>>>> theirs
=======
  const rows = React.useMemo(() => [draftRow], [draftRow])
  const updateRow = React.useCallback((id: string, updater: (row: ReviewRow) => ReviewRow) => {
    setDraftRow((current) => (current.id === id ? updater(current) : current))
  }, [])

>>>>>>> theirs
  const { generateDraft, saveDraft, verifyDraft, publishReply } = useReviewMutations({
    rows,
    updateRow,
    refresh,
  })

  const run = React.useCallback(async (
    nextBusy: "generate" | "save" | "verify" | "publish",
    fn: () => Promise<void>,
  ) => {
    setBusy(nextBusy)
    try {
      await fn()
      window.dispatchEvent(new CustomEvent("reviews:mutated", { detail: { reviewId } }))
      await Promise.resolve(refresh())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }, [refresh, reviewId])

  const handleGenerate = React.useCallback(() => {
    return run("generate", async () => {
      await generateDraft(reviewId)
    })
  }, [generateDraft, reviewId, run])

  const handleVerify = React.useCallback(() => {
    return run("verify", async () => {
      await verifyDraft(reviewId)
    })
  }, [reviewId, run, verifyDraft])

  const handleSave = React.useCallback(() => {
    return run("save", async () => {
      await saveDraft(reviewId, text)
    })
  }, [reviewId, run, saveDraft, text])

  const handlePublish = React.useCallback(() => {
    return run("publish", async () => {
      await publishReply(reviewId, text, draftRow)
    })
  }, [draftRow, publishReply, reviewId, run, text])

  const copyText = () => {
    if (!hasText) return
    navigator.clipboard?.writeText(text).then(
      () => toast.success("Draft copied"),
      () => toast.error("Copy failed")
    )
  }

  const clearText = () => {
    setText("")
  }

  if (!draft && !isReplied) {
    return (
      <div className="rounded-[24px] border-2 border-dashed border-primary/20 bg-primary/[0.02] px-6 py-12 text-center transition-all hover:bg-primary/[0.04]">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-glow-primary">
          <Sparkles className="h-8 w-8 text-primary-foreground" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-black tracking-tight text-foreground">Generate AI Response</h3>
          <p className="mx-auto max-w-sm text-sm font-medium leading-relaxed text-muted-foreground">
            Our AI analysis can create a personalized, professional response based on the guest&apos;s feedback.
          </p>
        </div>
        <Button
          type="button"
          onClick={handleGenerate}
          disabled={Boolean(busy)}
          className="mt-8 h-12 rounded-2xl bg-primary px-8 font-black shadow-glow-primary hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98]"
        >
          {busy === "generate" ? (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
              <RefreshCw className="mr-2 h-5 w-5" />
            </motion.div>
          ) : (
            <Sparkles className="mr-2 h-5 w-5" />
          )}
          Start AI Drafting
        </Button>
      </div>
    )
  }

  if (isReplied) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-black uppercase tracking-widest text-primary/70">
            Tone Preset
          </span>
          {isDirty && (
            <Badge className="rounded-full bg-amber-500/10 text-amber-600 border-none px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              Unsaved Changes
            </Badge>
          )}
        </div>
        <ToggleGroup
          type="single"
          value={tone}
          onValueChange={(value) => {
            if (value) setTone(value)
          }}
          className="rounded-xl border border-border/50 bg-muted/30 p-1"
        >
          {(["professional", "friendly", "apologetic"] as const).map((option) => (
            <ToggleGroupItem
              key={option}
              value={option}
              className={cn(
                "h-8 rounded-lg px-4 text-xs font-bold capitalize transition-all",
                tone === option
                  ? "bg-background text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div
        className={cn(
          "relative overflow-hidden rounded-[24px] border bg-background shadow-inner transition-all duration-300",
          isBlocked
            ? "border-destructive ring-4 ring-destructive/5"
            : "border-border/50 focus-within:border-primary/30 focus-within:ring-4 focus-within:ring-primary/5",
        )}
      >
        {!hasText && busy !== "generate" && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
            <Sparkles className="h-10 w-10 text-primary/10" />
            <span className="text-sm font-bold text-muted-foreground/30 uppercase tracking-widest">
              Awaiting Content
            </span>
          </div>
        )}

        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder=""
          disabled={busy === "generate"}
          className="min-h-[260px] resize-none border-0 bg-transparent p-6 text-base font-medium leading-relaxed text-foreground placeholder:text-transparent focus-visible:ring-0"
        />

        <div className="flex items-center justify-between border-t border-border/50 bg-muted/20 px-6 py-3">
          <div className="flex items-center gap-4">
            {isBlocked ? (
              <span className="inline-flex items-center gap-2 text-xs font-bold text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {verifierIssue || "Verification Failed"}
              </span>
            ) : draft?.status === "READY" ? (
              <span className="inline-flex items-center gap-2 text-xs font-bold text-emerald-600">
                <ShieldCheck className="h-4 w-4" />
                Verified & Ready
              </span>
            ) : (
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                Draft Status: Pending
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={copyText}
              disabled={!hasText}
              className="flex items-center gap-2 text-xs font-bold text-muted-foreground transition-all hover:text-primary disabled:opacity-30"
            >
              <Copy className="h-4 w-4" />
              Copy
            </button>
            <div className="h-4 w-px bg-border/50" />
            <span className="text-xs font-bold tabular-nums text-muted-foreground/60">
              {wordCount} Words
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] bg-muted/30 border border-border/50 p-4">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleGenerate}
            disabled={Boolean(busy)}
            className="h-10 rounded-xl bg-primary/10 px-5 text-xs font-bold text-primary shadow-none hover:bg-primary hover:text-primary-foreground transition-all"
          >
            {busy === "generate" ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                <RefreshCw className="mr-1.5 h-4 w-4" />
              </motion.div>
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}

            {draft?.text ? "Regenerate AI" : "Generate AI"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearText}
            disabled={!hasText || Boolean(busy)}
            className="h-10 w-10 rounded-xl text-destructive hover:bg-destructive/10 transition-all"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleVerify}
            disabled={!hasText || Boolean(busy)}
            className="h-10 rounded-xl border-border/50 bg-background px-5 text-xs font-bold shadow-sm transition-all hover:bg-muted/50"
          >
            {busy === "verify" ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                <RefreshCw className="mr-2 h-4 w-4" />
              </motion.div>
            ) : (
              <ShieldCheck className="mr-2 h-4 w-4" />
            )}
            AI Verify
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || Boolean(busy) || !hasText}
            className="h-10 rounded-xl border-border/50 bg-background px-5 text-xs font-bold shadow-sm transition-all hover:bg-muted/50"
          >
            {busy === "save" ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                <RefreshCw className="mr-2 h-4 w-4" />
              </motion.div>
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Draft
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handlePublish}
            disabled={!hasText || Boolean(busy)}
            className="h-10 rounded-xl bg-primary px-8 text-xs font-black text-primary-foreground shadow-glow-primary transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98]"
          >
            {busy === "publish" ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                <RefreshCw className="mr-2 h-4 w-4" />
              </motion.div>
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Post Reply
          </Button>
        </div>
      </div>

      <p className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
        <ShieldCheck className="h-3 w-3" />
        Official GBP Response System
      </p>
    </div>
  )
}
