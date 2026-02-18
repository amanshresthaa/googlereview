"use client"

import * as React from "react"
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MapPin,
  MessageSquare,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { formatAge, type ReviewRow } from "@/lib/hooks"
import { cn } from "@/lib/utils"

type BusyAction = "generate" | "verify" | "publish" | null
type SaveState = "idle" | "saving" | "saved" | "error"

type InboxDetailPanelProps = {
  row: ReviewRow | null
  onBack?: () => void
  onGenerateDraft: (reviewId: string) => Promise<void>
  onSaveDraft: (reviewId: string, text: string, options?: { silent?: boolean }) => Promise<void>
  onVerifyDraft: (reviewId: string) => Promise<void>
  onPublishReply: (reviewId: string, text: string, row: ReviewRow) => Promise<void>
}

function statusBadgeClass(status: ReviewRow["status"]) {
  if (status === "pending") {
    return "border-warning/30 bg-warning/10 text-warning-soft"
  }
  return "border-success/30 bg-success/10 text-success-soft"
}

function draftBadgeClass(status: ReviewRow["draftStatus"] | null) {
  if (status === "READY") return "border-success/30 bg-success/10 text-success-soft"
  if (status === "BLOCKED_BY_VERIFIER" || status === "POST_FAILED") return "border-warning/30 bg-warning/10 text-warning-soft"
  if (status === "POSTED") return "border-brand/30 bg-brand/15 text-brand-muted"
  if (status === "NEEDS_APPROVAL") return "border-shell-foreground/20 bg-shell-foreground/10 text-shell-foreground/70"
  return "border-shell-foreground/20 bg-shell-foreground/10 text-shell-foreground/60"
}

function draftStatusLabel(status: ReviewRow["draftStatus"] | null) {
  if (status === "READY") return "Ready"
  if (status === "NEEDS_APPROVAL") return "Needs Approval"
  if (status === "BLOCKED_BY_VERIFIER") return "Blocked"
  if (status === "POSTED") return "Posted"
  if (status === "POST_FAILED") return "Post Failed"
  return "No Draft"
}

function StarStrip({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1" role="img" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={`${rating}-${String(index)}`}
          className={cn(
            "h-4 w-4",
            index < rating ? "fill-star text-star" : "fill-shell-foreground/10 text-shell-foreground/20",
          )}
        />
      ))}
    </div>
  )
}

export function InboxDetailPanel({
  row,
  onBack,
  onGenerateDraft,
  onSaveDraft,
  onVerifyDraft,
  onPublishReply,
}: InboxDetailPanelProps) {
  const [draftInput, setDraftInput] = React.useState("")
  const [busy, setBusy] = React.useState<BusyAction>(null)
  const [saveState, setSaveState] = React.useState<SaveState>("idle")
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveFeedbackTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedDraftRef = React.useRef("")

  React.useEffect(() => {
    const nextDraft = row?.currentDraft?.text ?? ""
    setDraftInput(nextDraft)
    lastSavedDraftRef.current = nextDraft
    setSaveState("idle")
  }, [row?.id, row?.currentDraft?.text])

  React.useEffect(() => {
    if (!row) return
    if (busy !== null) return

    const trimmed = draftInput.trim()
    const lastSaved = lastSavedDraftRef.current.trim()
    if (!trimmed || trimmed === lastSaved) return

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      setSaveState("saving")
      void onSaveDraft(row.id, draftInput, { silent: true })
        .then(() => {
          lastSavedDraftRef.current = draftInput
          setSaveState("saved")
          if (saveFeedbackTimerRef.current) clearTimeout(saveFeedbackTimerRef.current)
          saveFeedbackTimerRef.current = setTimeout(() => {
            setSaveState("idle")
          }, 1000)
        })
        .catch(() => {
          setSaveState("error")
        })
    }, 700)

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
    }
  }, [busy, draftInput, onSaveDraft, row])

  React.useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (saveFeedbackTimerRef.current) clearTimeout(saveFeedbackTimerRef.current)
    }
  }, [])

  const runAction = React.useCallback(async (action: Exclude<BusyAction, null>, work: () => Promise<void>) => {
    setBusy(action)
    try {
      await work()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed")
    } finally {
      setBusy(null)
    }
  }, [])

  const handlePublish = React.useCallback(() => {
    if (!row) return
    if (!draftInput.trim()) {
      toast.error("Draft is empty.")
      return
    }
    void runAction("publish", async () => {
      await onPublishReply(row.id, draftInput, row)
    })
  }, [draftInput, onPublishReply, row, runAction])

  if (!row) {
    return (
      <section className="hidden min-h-0 rounded-3xl border border-shell-foreground/10 bg-shell-foreground/[0.04] p-8 backdrop-blur lg:flex lg:flex-col lg:items-center lg:justify-center">
        <div className="mx-auto max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-shell-foreground/15 bg-shell-foreground/5">
            <MessageSquare className="h-6 w-6 text-shell-foreground/50" />
          </div>
          <h3 className="text-xl font-black tracking-tight text-shell-foreground/90">Select a review</h3>
          <p className="mt-2 text-sm text-shell-foreground/60">
            Use the left triage lane to choose a conversation. Your draft workspace stays pinned here for faster bulk handling.
          </p>
        </div>
      </section>
    )
  }

  const reviewerName = row.reviewer.displayName ?? "Anonymous reviewer"
  const reviewText = row.comment.trim() || row.snippet.trim() || "No written review content provided."
  const draftStatus = row.currentDraft?.status ?? row.draftStatus
  const postedReply = row.reply.comment?.trim() ?? ""
  const createdAge = formatAge(row.createTimeIso)
  const hasDraft = draftInput.trim().length > 0

  return (
    <section className="min-h-0 rounded-3xl border border-shell-foreground/10 bg-shell-foreground/[0.04] backdrop-blur">
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex flex-wrap items-center gap-2 border-b border-shell-foreground/10 px-4 py-3 sm:px-5">
          {onBack ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="h-8 rounded-full px-3 text-shell-foreground/70 hover:text-shell-foreground/90"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-lg font-black tracking-tight text-shell-foreground/95">{reviewerName}</h3>
              <Badge className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", statusBadgeClass(row.status))}>
                {row.status}
              </Badge>
              <Badge className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", draftBadgeClass(draftStatus))}>
                {draftStatusLabel(draftStatus)}
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-shell-foreground/50">
              <span>{createdAge} ago</span>
              <span className="h-1 w-1 rounded-full bg-shell-foreground/30" />
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {row.location.displayName}
              </span>
            </div>
          </div>
          <StarStrip rating={row.starRating} />
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          <section className="rounded-2xl border border-shell-foreground/10 bg-shell-foreground/[0.03] p-4">
            <p className="type-kicker mb-2 text-shell-foreground/45">Customer review</p>
            <p className="text-sm leading-relaxed text-shell-foreground/85">{reviewText}</p>
          </section>

          {postedReply ? (
            <section className="rounded-2xl border border-success/25 bg-success/10 p-4">
              <div className="mb-2 flex items-center gap-2 text-success-soft">
                <CheckCircle2 className="h-4 w-4" />
                <p className="type-kicker">Published reply</p>
              </div>
              <p className="text-sm leading-relaxed text-success-soft/90">{postedReply}</p>
            </section>
          ) : null}

          <section className="rounded-2xl border border-shell-foreground/10 bg-shell-foreground/[0.03]">
            <div className="flex items-center justify-between px-4 py-2.5">
              <p className="type-kicker text-shell-foreground/50">Draft workspace</p>
              <span className="text-xs text-shell-foreground/45">
                {saveState === "saving"
                  ? "Saving..."
                  : saveState === "saved"
                    ? "Autosaved"
                    : saveState === "error"
                      ? "Autosave failed"
                      : "Autosave active"}
              </span>
            </div>
            <Separator className="bg-shell-foreground/10" />
            <Textarea
              value={draftInput}
              onChange={(event) => setDraftInput(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault()
                  handlePublish()
                }
              }}
              placeholder="Write and refine your public reply..."
              className="min-h-[220px] resize-y border-0 bg-transparent p-4 text-sm leading-relaxed text-shell-foreground/90 placeholder:text-shell-foreground/35 focus-visible:ring-0"
            />
          </section>
        </div>

        <footer className="border-t border-shell-foreground/10 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                void runAction("generate", async () => {
                  await onGenerateDraft(row.id)
                })
              }}
              disabled={busy === "generate"}
              className="h-9 rounded-xl px-3"
            >
              {busy === "generate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                void runAction("verify", async () => {
                  await onVerifyDraft(row.id)
                })
              }}
              disabled={busy === "verify" || !hasDraft}
              className="h-9 rounded-xl px-3"
            >
              {busy === "verify" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Verify
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handlePublish}
              disabled={busy === "publish" || !hasDraft}
              className="ml-auto h-9 rounded-xl px-4"
            >
              {busy === "publish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Publish
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-shell-foreground/40">Shortcut: press Cmd/Ctrl + Enter to publish the current draft.</p>
        </footer>
      </div>
    </section>
  )
}
