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
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { INBOX_THEME_CLASSES } from "@/lib/design-system/inbox-theme"
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
          className={cn("h-3.5 w-3.5", index < rating ? "text-[#007AFF]" : "text-slate-300")}
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
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/60 bg-white/75 text-xs font-black text-slate-700 shadow-[0_10px_18px_rgba(15,23,42,0.12)]">
      {initials}
    </div>
  )
}

function AiAvatar() {
  return (
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[#007AFF]/35 bg-[#007AFF]/15 text-[#007AFF] shadow-[0_10px_18px_rgba(0,122,255,0.2)]">
      <Sparkles className="h-4 w-4" strokeWidth={ICON_STROKE} />
    </div>
  )
}

function ActionButton({
  tooltip,
  onClick,
  disabled,
  className,
  children,
}: {
  tooltip: string
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
            "h-10 rounded-xl border border-white/20 bg-white/10 px-3 text-white transition-all duration-300 hover:bg-white/20",
            className,
          )}
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
    NEEDS_APPROVAL: { label: "Pending review", className: "border-orange-300/45 bg-orange-200/25 text-orange-100" },
    READY: { label: "Verified", className: "border-emerald-300/45 bg-emerald-200/25 text-emerald-100" },
    BLOCKED_BY_VERIFIER: { label: "Changes needed", className: "border-rose-300/45 bg-rose-200/25 text-rose-100" },
    POSTED: { label: "Published", className: "border-blue-300/45 bg-blue-200/25 text-blue-100" },
    POST_FAILED: { label: "Publish failed", className: "border-rose-300/45 bg-rose-200/25 text-rose-100" },
  }
  const entry = config[status] ?? {
    label: status,
    className: "border-white/30 bg-white/10 text-white",
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]",
        entry.className,
      )}
    >
      {status === "READY" ? <ShieldCheck className="h-3 w-3" strokeWidth={ICON_STROKE} /> : null}
      {status === "BLOCKED_BY_VERIFIER" ? <AlertTriangle className="h-3 w-3" strokeWidth={ICON_STROKE} /> : null}
      {entry.label}
    </span>
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
      className="mb-6"
    >
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.13em] text-slate-500">
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
                  ? "border-white/65 bg-white/72 text-slate-800"
                  : "border-white/45 bg-white/32 text-slate-600",
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", isCurrent ? "bg-[#007AFF]" : "bg-slate-400")} />
              <span className="font-black tracking-[-0.01em]">v{draft.version}</span>
              <span className="ml-auto text-[10px] font-semibold text-slate-500">{updatedLabel}</span>
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

  if (!row) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-[linear-gradient(160deg,rgba(255,255,255,0.3),rgba(255,255,255,0.15))]">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.38 }}
          className="flex max-w-sm flex-col items-center gap-4 rounded-[34px] border border-white/60 bg-white/48 px-8 py-9 text-center shadow-[0_22px_60px_rgba(15,23,42,0.16)] backdrop-blur-3xl"
        >
          <div className="grid h-20 w-20 place-items-center rounded-[28px] border border-white/70 bg-white/80 text-[#007AFF]">
            <Inbox className="h-9 w-9" strokeWidth={ICON_STROKE} />
          </div>
          <div>
            <h3 className="text-2xl font-black tracking-[-0.03em] text-slate-900">Select a conversation</h3>
            <p className="mt-1 text-sm font-medium text-slate-600">
              Choose a review to open the workspace and start drafting a response.
            </p>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={280}>
      <section className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[linear-gradient(160deg,rgba(255,255,255,0.25),rgba(255,255,255,0.12))]">
        <ScrollArea className="h-full">
          <div className="mx-auto w-full max-w-4xl px-4 pb-60 pt-5 md:px-8 md:pb-64 md:pt-8">
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

            <div className="mb-4 flex justify-center">
              <div className={INBOX_THEME_CLASSES.detailLocationChip}>
                <MapPin className="h-3 w-3" strokeWidth={ICON_STROKE} />
                {row.location.displayName}
              </div>
            </div>

            {detailLoading ? (
              <div className="mb-4 flex justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/55 bg-white/65 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
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
                className="mb-6 flex items-start gap-3"
              >
                <ReviewerAvatar name={row.reviewer.displayName} />
                <div className="min-w-0 max-w-[88%]">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-sm font-black tracking-[-0.01em] text-slate-900">
                      {row.reviewer.displayName ?? "Anonymous"}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">{formatAge(row.createTimeIso)} ago</span>
                  </div>
                  <div className="rounded-[28px] rounded-tl-[14px] border border-white/60 bg-white/78 px-5 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.1)] backdrop-blur-2xl">
                    <div className="mb-2.5">
                      <StarRow rating={row.starRating} />
                    </div>
                    <p className="text-[15px] font-medium leading-relaxed text-slate-700">
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
                className="mb-6 flex items-start justify-end gap-3"
              >
                <div className="min-w-0 max-w-[88%]">
                  <div className="mb-1 flex items-center justify-end gap-2 text-[11px] font-semibold text-slate-500">
                    Published reply
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" strokeWidth={ICON_STROKE} />
                  </div>
                  <div className="rounded-[28px] rounded-tr-[14px] border border-white/65 bg-white/76 px-5 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.1)] backdrop-blur-2xl">
                    <p className="text-[15px] font-medium leading-relaxed text-slate-700">{row.reply.comment}</p>
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
                className="mb-6 flex items-start justify-end gap-3"
              >
                <div className="min-w-0 max-w-[88%]">
                  <div className="mb-1 flex items-center justify-end gap-2 text-[11px] font-black uppercase tracking-[0.13em] text-slate-500">
                    AI Draft
                  </div>
                  <div className="rounded-[28px] rounded-tr-[14px] border border-white/65 bg-white/78 px-5 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.1)] backdrop-blur-2xl">
                    {busy === "generate" ? (
                      <div className="flex min-h-[120px] items-center justify-center text-[#007AFF]">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-6 w-6 animate-spin" />
                          <span className="text-[10px] font-black uppercase tracking-[0.16em]">Generating response</span>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap text-[15px] font-medium leading-relaxed text-slate-700">{text}</p>
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
                  <span className="text-sm font-black uppercase tracking-[0.15em]">Published successfully</span>
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
                <div className="relative mb-3">
                  {showGeneratingGlow ? (
                    <div className="tahoe-intelligence-glow pointer-events-none absolute -inset-1 rounded-[40px] opacity-85 blur-[6px] motion-safe:animate-[spin_3.5s_linear_infinite]" />
                  ) : null}
                  <div className="relative rounded-[40px] border border-white/25 bg-white/10 p-3">
                    <Textarea
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      placeholder="Shape the final response before publishing..."
                      disabled={busy === "generate"}
                      rows={3}
                      className="min-h-[110px] resize-none rounded-[32px] border-none bg-transparent px-2 py-1 text-[16px] font-medium leading-relaxed text-white shadow-none outline-none ring-0 placeholder:text-white/55 focus-visible:ring-0"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <DraftStatusChip status={detail?.currentDraft?.status ?? row.currentDraft?.status ?? row.draftStatus} />

                  {saveState === "saving" ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.12em] text-white/80">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Saving
                    </span>
                  ) : null}

                  {saveState === "saved" ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" strokeWidth={ICON_STROKE} />
                      Saved
                    </span>
                  ) : null}

                  <span className="ml-auto text-[10px] font-black uppercase tracking-[0.12em] text-white/70">
                    {wordCount} {wordCount === 1 ? "word" : "words"}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <ActionButton
                    tooltip="Generate AI draft"
                    onClick={() =>
                      void runAction("generate", async () => {
                        await onGenerate(row.id)
                      })
                    }
                    disabled={busy !== null}
                    className="text-[#b5fffc]"
                  >
                    {busy === "generate" ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={ICON_STROKE} /> : <Sparkles className="h-4 w-4" strokeWidth={ICON_STROKE} />}
                  </ActionButton>

                  <ActionButton
                    tooltip="Tone check"
                    onClick={() =>
                      void runAction("verify", async () => {
                        await onVerify(row.id)
                      })
                    }
                    disabled={busy !== null || !hasText}
                  >
                    {busy === "verify" ? <RefreshCw className="h-4 w-4 animate-spin" strokeWidth={ICON_STROKE} /> : <ShieldCheck className="h-4 w-4" strokeWidth={ICON_STROKE} />}
                  </ActionButton>

                  <ActionButton
                    tooltip="Save draft"
                    onClick={() =>
                      void runAction("save", async () => {
                        await onSave(row.id, text)
                      })
                    }
                    disabled={busy !== null || !hasText || !isDirty}
                  >
                    {busy === "save" ? <RefreshCw className="h-4 w-4 animate-spin" strokeWidth={ICON_STROKE} /> : <Save className="h-4 w-4" strokeWidth={ICON_STROKE} />}
                  </ActionButton>

                  <ActionButton tooltip="Copy draft" onClick={() => void copyDraft()} disabled={!hasText}>
                    <Copy className="h-4 w-4" strokeWidth={ICON_STROKE} />
                  </ActionButton>

                  <span className="hidden text-[10px] font-black uppercase tracking-[0.12em] text-white/65 md:inline">
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
