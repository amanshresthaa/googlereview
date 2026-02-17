"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  History,
  Inbox,
  Loader2,
  MapPin,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react"
import { toast } from "sonner"

import { InlineError } from "@/components/ErrorStates"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { INBOX_THEME_CLASSES, inboxStarClass } from "@/lib/design-system/inbox-theme"
import { formatAge, type ReviewDetail, type ReviewRow } from "@/lib/hooks"
import { cn } from "@/lib/utils"

type DetailAction = "generate" | "save" | "verify" | "publish"
const ICON_STROKE = 2.6

type InboxDetailPanelProps = {
  row: ReviewRow | null
  detail?: ReviewDetail | null
  detailLoading?: boolean
  showMobileBack?: boolean
  onBack?: () => void
  onGenerate: (reviewId: string) => Promise<void>
  onSave: (reviewId: string, text: string, options?: { silent?: boolean }) => Promise<void>
  onVerify: (reviewId: string) => Promise<void>
  onPublish: (reviewId: string, text: string, row: ReviewRow) => Promise<void>
}

const bubbleVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} stars`} role="img">
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={`${rating}-${String(index)}`}
          fill={index < rating ? "currentColor" : "none"}
          strokeWidth={ICON_STROKE}
          className={cn("h-3.5 w-3.5", inboxStarClass(index < rating))}
        />
      ))}
    </div>
  )
}

function ReviewerAvatar({ name }: { name: string | null }) {
  const initials = (name ?? "A")
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-shell-foreground/68 bg-shell-foreground/82 text-[11px] font-black text-ink-soft shadow-elevated">
      {initials}
    </div>
  )
}

function AiAvatar() {
  return (
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-gbp-blue/35 bg-gbp-blue/15 text-gbp-blue shadow-glow-primary">
      <Sparkles className="h-4 w-4" strokeWidth={ICON_STROKE} />
    </div>
  )
}

function ActionButton({
  tooltip,
  ariaLabel,
  onClick,
  disabled,
  className,
  children,
}: {
  tooltip: string
  ariaLabel?: string
  onClick: () => void
  disabled?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-10 rounded-xl border border-shell-foreground/22 bg-shell-foreground/12 px-3 text-shell-foreground/90 transition-all duration-300 hover:bg-shell-foreground/22",
            className,
          )}
          aria-label={ariaLabel ?? tooltip}
          onClick={onClick}
          disabled={disabled}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{tooltip}</TooltipContent>
    </Tooltip>
  )
}

function DraftStatusChip({ status }: { status: string | null }) {
  if (!status) return null

  const config: Record<string, { label: string; className: string }> = {
    NEEDS_APPROVAL: { label: "Pending review", className: "inbox-draft-status-needs-approval" },
    READY: { label: "Verified", className: "inbox-draft-status-ready" },
    BLOCKED_BY_VERIFIER: { label: "Changes needed", className: "inbox-draft-status-blocked" },
    POSTED: { label: "Published", className: "inbox-draft-status-posted" },
    POST_FAILED: { label: "Publish failed", className: "inbox-draft-status-error" },
  }
  const entry = config[status] ?? {
    label: status,
    className: "border-shell-foreground/10 bg-shell-foreground/10 text-foreground",
  }

  return (
    <Badge
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.1em]",
        entry.className,
      )}
    >
      {status === "READY" ? <ShieldCheck className="h-3 w-3" strokeWidth={ICON_STROKE} /> : null}
      {status === "BLOCKED_BY_VERIFIER" ? <AlertTriangle className="h-3 w-3" strokeWidth={ICON_STROKE} /> : null}
      {entry.label}
    </Badge>
  )
}

function DraftHistoryTimeline({
  drafts,
  currentDraftId,
}: {
  drafts: ReviewDetail["drafts"]
  currentDraftId: string | null
}) {
  if (drafts.length <= 1) return null

  const sorted = [...drafts].sort((a, b) => b.version - a.version)

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="mb-7"
    >
      <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.11em] text-ink-muted">
        <History className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} />
        {drafts.length} versions
      </div>
      <div className="space-y-1.5">
        {sorted.slice(0, 5).map((draft) => {
          const isCurrent = draft.id === currentDraftId
          const updatedLabel = draft.updatedAt ? `${formatAge(draft.updatedAt)} ago` : "Recently"
          return (
            <div
              key={draft.id}
              className={cn(
                "flex items-center gap-2 rounded-2xl border px-3 py-2 text-[11px] backdrop-blur-xl",
                isCurrent
                  ? "border-shell-foreground/70 bg-shell-foreground/78 text-ink"
                  : "border-shell-foreground/52 bg-shell-foreground/42 text-ink-soft",
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", isCurrent ? "bg-gbp-blue" : "bg-muted-foreground")} />
              <span className="font-black tracking-[-0.01em]">v{draft.version}</span>
              <span className="ml-auto text-[11px] font-medium text-ink-muted">{updatedLabel}</span>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

export function InboxDetailPanel({
  row,
  detail,
  detailLoading,
  showMobileBack = false,
  onBack,
  onGenerate,
  onSave,
  onVerify,
  onPublish,
}: InboxDetailPanelProps) {
  const [text, setText] = React.useState("")
  const [busy, setBusy] = React.useState<DetailAction | null>(null)
  const [inlineError, setInlineError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setText(row?.currentDraft?.text ?? "")
    setInlineError(null)
  }, [row?.currentDraft?.text])

  const runAction = React.useCallback(async (action: DetailAction, work: () => Promise<void>) => {
    setInlineError(null)
    setBusy(action)

    try {
      await work()
    } catch (error) {
      setInlineError(error instanceof Error ? error.message : "Action failed")
    } finally {
      setBusy(null)
    }
  }, [])

  const copyDraft = React.useCallback(async () => {
    if (!text.trim()) return

    try {
      await navigator.clipboard.writeText(text)
      toast.success("Draft copied")
    } catch {
      toast.error("Copy failed")
    }
  }, [text])

  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved">("idle")
  const autoSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedTextRef = React.useRef<string>("")

  React.useEffect(() => {
    lastSavedTextRef.current = row?.currentDraft?.text ?? ""
  }, [row?.currentDraft?.text])

  React.useEffect(() => {
    if (!row || busy !== null) return
    const isDirtyFromSaved = text.trim() !== lastSavedTextRef.current.trim()
    if (!isDirtyFromSaved || !text.trim()) return

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)

    autoSaveTimerRef.current = setTimeout(() => {
      setSaveState("saving")
      void onSave(row.id, text, { silent: true })
        .then(() => {
          lastSavedTextRef.current = text
          setSaveState("saved")
          setTimeout(() => setSaveState("idle"), 2000)
        })
        .catch(() => {
          setSaveState("idle")
        })
    }, 1200)

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [text, row, busy, onSave])

  React.useEffect(() => {
    if (!row) {
      setSaveState("idle")
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
        autoSaveTimerRef.current = null
      }
      return
    }

    setSaveState("idle")
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }
  }, [row])

  const isReplied = row?.status === "replied"
  const hasText = text.trim().length > 0
  const isDirty = text !== (row?.currentDraft?.text ?? "")
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length
  const showGeneratingGlow = busy === "generate"
  const currentDraftStatus = detail?.currentDraft?.status ?? row?.currentDraft?.status ?? row?.draftStatus ?? null
  const verifyActionBlocked = currentDraftStatus === "READY" && !isDirty
  const verifyDisabled = busy !== null || !hasText || verifyActionBlocked
  const verifyTooltip = verifyActionBlocked ? "Already verified" : "Tone check"

  React.useEffect(() => {
    if (!row || isReplied) return

    const handler = (event: KeyboardEvent) => {
      const isMod = event.metaKey || event.ctrlKey
      if (!isMod) return

      if (event.key === "Enter" && hasText && busy === null) {
        event.preventDefault()
        void runAction("publish", async () => {
          await onPublish(row.id, text, row)
        })
      } else if (event.key === "s" && hasText && isDirty && busy === null) {
        event.preventDefault()
        void runAction("save", async () => {
          await onSave(row.id, text)
        })
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [row, isReplied, hasText, isDirty, busy, text, runAction, onSave, onPublish])

  React.useEffect(() => {
    if (!showMobileBack || !onBack) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      onBack()
    }

    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [onBack, showMobileBack])

  if (!row) {
    return (
      <div className="inbox-detail-stage flex h-full min-h-0 items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.38 }}
          className="flex max-w-sm flex-col items-center gap-5 rounded-[34px] border border-shell-foreground/65 bg-shell-foreground/56 px-8 py-10 text-center shadow-floating backdrop-blur-3xl"
        >
          <div className="grid h-20 w-20 place-items-center rounded-[28px] border border-shell-foreground/70 bg-shell-foreground/80 text-gbp-blue">
            <Inbox className="h-9 w-9" strokeWidth={ICON_STROKE} />
          </div>
          <div>
            <h3 className="text-[2rem] font-black tracking-[-0.03em] text-ink-strong">Select a conversation</h3>
            <p className="mt-1.5 text-[15px] font-medium text-ink-soft">
              Choose a review to open the workspace and start drafting a response.
            </p>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={280}>
      <section className="inbox-detail-stage-soft relative flex h-full min-h-0 flex-col overflow-hidden">
        <ScrollArea className="h-full">
          <div className="mx-auto w-full max-w-4xl px-4 pb-56 pt-6 md:px-8 md:pb-60 md:pt-9">
            {showMobileBack ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={INBOX_THEME_CLASSES.detailBackButton}
                onClick={onBack}
              >
                <ArrowLeft className="mr-1 h-4 w-4" strokeWidth={ICON_STROKE} />
                Back to inbox
              </Button>
            ) : null}

            <div className="mb-5 flex justify-center">
              <div className={INBOX_THEME_CLASSES.detailLocationChip}>
                <MapPin className="h-3 w-3" strokeWidth={ICON_STROKE} />
                {row.location.displayName}
              </div>
            </div>

            {detailLoading ? (
              <div className="mb-5 flex justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gbp-blue/28 bg-shell-foreground/82 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-gbp-blue">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Syncing draft history
                </span>
              </div>
            ) : null}

            <AnimatePresence mode="wait">
              <motion.div
                key={`review-${row.id}`}
                variants={bubbleVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                className="mb-7 flex items-start gap-3.5"
              >
                <ReviewerAvatar name={row.reviewer.displayName} />
                <div className="min-w-0 max-w-[88%]">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-[15px] font-black tracking-[-0.01em] text-ink-strong">
                      {row.reviewer.displayName ?? "Anonymous"}
                    </span>
                    <span className="text-[12px] font-medium text-ink-muted">{formatAge(row.createTimeIso)} ago</span>
                  </div>
                  <div className="rounded-[28px] rounded-tl-[14px] border border-shell-foreground/68 bg-shell-foreground/84 px-5 py-[18px] shadow-card backdrop-blur-2xl">
                    <div className="mb-2.5">
                      <StarRow rating={row.starRating} />
                    </div>
                    <p className="text-[15px] font-medium leading-relaxed text-ink">
                      {row.comment || "No written comment provided."}
                    </p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {isReplied && row.reply?.comment ? (
              <motion.div
                variants={bubbleVariants}
                initial="hidden"
                animate="visible"
                transition={{ duration: 0.24, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="mb-7 flex items-start justify-end gap-3.5"
              >
                <div className="min-w-0 max-w-[88%]">
                  <div className="mb-1 flex items-center justify-end gap-2 text-[11px] font-semibold text-ink-muted">
                    Published reply
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" strokeWidth={ICON_STROKE} />
                  </div>
                  <div className="rounded-[28px] rounded-tr-[14px] border border-shell-foreground/68 bg-shell-foreground/84 px-5 py-[18px] shadow-card backdrop-blur-2xl">
                    <p className="text-[15px] font-medium leading-relaxed text-ink">{row.reply.comment}</p>
                  </div>
                </div>
                <AiAvatar />
              </motion.div>
            ) : null}

            {!isReplied && (text || busy === "generate") ? (
              <motion.div
                variants={bubbleVariants}
                initial="hidden"
                animate="visible"
                transition={{ duration: 0.24, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="mb-7 flex items-start justify-end gap-3.5"
              >
                <div className="min-w-0 max-w-[88%]">
                  <div className="mb-1 flex items-center justify-end gap-2 text-[11px] font-semibold uppercase tracking-[0.11em] text-ink-muted">
                    AI Draft
                  </div>
                  <div className="rounded-[28px] rounded-tr-[14px] border border-shell-foreground/68 bg-shell-foreground/84 px-5 py-[18px] shadow-card backdrop-blur-2xl">
                    {busy === "generate" ? (
                      <div className="flex min-h-[120px] items-center justify-center text-gbp-blue">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-6 w-6 animate-spin" />
                          <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">Generating response</span>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap text-[15px] font-medium leading-relaxed text-ink">{text}</p>
                    )}
                  </div>
                </div>
                <AiAvatar />
              </motion.div>
            ) : null}

            {!isReplied && detail?.drafts && detail.drafts.length > 1 ? (
              <DraftHistoryTimeline drafts={detail.drafts} currentDraftId={detail.currentDraft?.id ?? null} />
            ) : null}

            <AnimatePresence>
              {inlineError ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4"
                >
                  <InlineError error={inlineError} />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </ScrollArea>

        <AnimatePresence>
          {isReplied ? (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className={INBOX_THEME_CLASSES.actionIslandWrap}
            >
              <div className={INBOX_THEME_CLASSES.actionIsland}>
                <div className={INBOX_THEME_CLASSES.islandSuccess}>
                   <CheckCircle2 className="h-5 w-5" strokeWidth={ICON_STROKE} />
                  <span className="text-sm font-black uppercase tracking-[0.12em]">Published successfully</span>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className={INBOX_THEME_CLASSES.actionIslandWrap}
            >
              <div className={INBOX_THEME_CLASSES.actionIsland}>
                <div className="relative mb-3.5">
                  {showGeneratingGlow ? (
                    <div className="tahoe-intelligence-glow pointer-events-none absolute -inset-1 rounded-[40px] opacity-85 blur-[6px] motion-safe:animate-[spin_3.5s_linear_infinite]" />
                  ) : null}
                  <div className="relative rounded-[40px] border border-shell-foreground/25 bg-shell-foreground/10 p-3">
                    <Textarea
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      placeholder="Shape the final response before publishing..."
                      aria-label="Draft response"
                      disabled={busy === "generate"}
                      rows={3}
                      className="min-h-[112px] resize-none rounded-[32px] border-none bg-transparent px-2 py-1 text-[15px] font-medium leading-relaxed text-shell-foreground shadow-none outline-none ring-0 placeholder:text-shell-foreground/60 focus-visible:ring-0"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <DraftStatusChip status={currentDraftStatus} />

                  <p className="sr-only" role="status" aria-live="polite">
                    {saveState === "saving"
                      ? "Saving draft"
                      : saveState === "saved"
                        ? "Draft saved"
                        : "Draft idle"}
                  </p>

                  {saveState === "saving" ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-shell-foreground/80">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Saving
                    </span>
                  ) : null}

                  {saveState === "saved" ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-success-soft">
                      <CheckCircle2 className="h-3 w-3" strokeWidth={ICON_STROKE} />
                      Saved
                    </span>
                  ) : null}

                  <span className="ml-auto text-[11px] font-semibold uppercase tracking-[0.1em] text-shell-foreground/72">
                    {wordCount} {wordCount === 1 ? "word" : "words"}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <ActionButton
                    tooltip="Generate AI draft"
                    ariaLabel="Generate AI draft"
                    onClick={() =>
                      void runAction("generate", async () => {
                        await onGenerate(row.id)
                      })
                    }
                    disabled={busy !== null}
                    className="text-highlight-cyan"
                  >
                    {busy === "generate" ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={ICON_STROKE} /> : <Sparkles className="h-4 w-4" strokeWidth={ICON_STROKE} />}
                  </ActionButton>

                  <ActionButton
                    tooltip={verifyTooltip}
                    ariaLabel={verifyTooltip}
                    onClick={() =>
                      void runAction("verify", async () => {
                        await onVerify(row.id)
                      })
                    }
                    disabled={verifyDisabled}
                  >
                    {busy === "verify" ? <RefreshCw className="h-4 w-4 animate-spin" strokeWidth={ICON_STROKE} /> : <ShieldCheck className="h-4 w-4" strokeWidth={ICON_STROKE} />}
                  </ActionButton>

                  <ActionButton
                    tooltip="Save draft"
                    ariaLabel="Save draft"
                    onClick={() =>
                      void runAction("save", async () => {
                        await onSave(row.id, text)
                      })
                    }
                    disabled={busy !== null || !hasText || !isDirty}
                  >
                    {busy === "save" ? <RefreshCw className="h-4 w-4 animate-spin" strokeWidth={ICON_STROKE} /> : <Save className="h-4 w-4" strokeWidth={ICON_STROKE} />}
                  </ActionButton>

                  <ActionButton tooltip="Copy draft" ariaLabel="Copy draft" onClick={() => void copyDraft()} disabled={!hasText}>
                    <Copy className="h-4 w-4" strokeWidth={ICON_STROKE} />
                  </ActionButton>

                  <span className="hidden text-[11px] font-semibold uppercase tracking-[0.1em] text-shell-foreground/70 md:inline">
                    ⌘↵ publish
                  </span>

                  <Button
                    type="button"
                    onClick={() =>
                      void runAction("publish", async () => {
                        await onPublish(row.id, text, row)
                      })
                    }
                    disabled={busy !== null || !hasText}
                    className={cn(INBOX_THEME_CLASSES.islandPrimary, "ml-auto")}
                  >
                    {busy === "publish" ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" strokeWidth={ICON_STROKE} />
                    ) : (
                      <Send className="mr-1.5 h-4 w-4" strokeWidth={ICON_STROKE} />
                    )}
                    Publish
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </TooltipProvider>
  )
}
