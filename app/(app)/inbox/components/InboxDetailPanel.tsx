"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"

import { EmptyState, InlineError } from "@/components/ErrorStates"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { INBOX_THEME_CLASSES } from "@/lib/design-system/inbox-theme"
import { formatAge, type ReviewRow, type ReviewDetail } from "@/lib/hooks"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Copy,
  History,
  InboxIcon,
  Loader2,
  MapPin,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Star,
  Send,
} from "@/components/icons"

type DetailAction = "generate" | "save" | "verify" | "publish"

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
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

const composerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} stars`} role="img">
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={`${rating}-${String(index)}`}
          weight={index < rating ? "fill" : "regular"}
          className={cn("h-3.5 w-3.5", index < rating ? "text-[#007aff]" : "text-slate-300")}
        />
      ))}
    </div>
  )
}

function ReviewerAvatar({ name }: { name: string | null }) {
  const initials = (name ?? "A")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-800 text-xs font-bold text-white">
      {initials}
    </div>
  )
}

function AiAvatar() {
  return (
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#007aff] text-white">
      <Sparkles className="h-4 w-4" weight="fill" />
    </div>
  )
}

function ActionButton({
  tooltip,
  onClick,
  disabled,
  variant = "outline",
  className,
  children,
}: {
  tooltip: string
  onClick: () => void
  disabled?: boolean
  variant?: "outline" | "default" | "ghost"
  className?: string
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size="sm"
          className={cn("h-9 w-9 rounded-xl p-0", className)}
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
    NEEDS_APPROVAL: { label: "Pending review", className: "bg-amber-50 text-amber-600 border-amber-200/60" },
    READY: { label: "Verified", className: "bg-emerald-50 text-emerald-600 border-emerald-200/60" },
    BLOCKED_BY_VERIFIER: { label: "Changes needed", className: "bg-rose-50 text-rose-600 border-rose-200/60" },
    POSTED: { label: "Published", className: "bg-blue-50 text-blue-600 border-blue-200/60" },
    POST_FAILED: { label: "Publish failed", className: "bg-rose-50 text-rose-600 border-rose-200/60" },
  }
  const entry = config[status] ?? { label: status, className: "bg-slate-50 text-slate-500 border-slate-200/60" }

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold", entry.className)}>
      {status === "READY" && <ShieldCheck className="h-3 w-3" />}
      {status === "BLOCKED_BY_VERIFIER" && <AlertTriangle className="h-3 w-3" />}
      {entry.label}
    </span>
  )
}

function DraftHistoryTimeline({ drafts, currentDraftId }: { drafts: ReviewDetail["drafts"]; currentDraftId: string | null }) {
  if (drafts.length <= 1) return null

  const sorted = [...drafts].sort((a, b) => b.version - a.version)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.25 }}
      className="mb-6"
    >
      <button
        type="button"
        className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-400 transition-colors hover:text-slate-600"
        onClick={() => {}}
      >
        <History className="h-3.5 w-3.5" />
        {drafts.length} draft {drafts.length === 1 ? "version" : "versions"}
      </button>
      <div className="space-y-1.5">
        {sorted.slice(0, 5).map((draft) => {
          const isCurrent = draft.id === currentDraftId
          return (
            <div
              key={draft.id}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px]",
                isCurrent ? "bg-blue-50/60 text-slate-700" : "text-slate-400"
              )}
            >
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", isCurrent ? "bg-[#007aff]" : "bg-slate-300")} />
              <span className="font-semibold">v{draft.version}</span>
              <DraftStatusChip status={draft.status} />
              {draft.updatedAt && (
                <span className="ml-auto text-[10px] text-slate-400">{formatAge(draft.updatedAt)} ago</span>
              )}
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
  const scrollRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    setText(row?.currentDraft?.text ?? "")
    setInlineError(null)
  }, [row?.id, row?.currentDraft?.id, row?.currentDraft?.text])

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

  // Auto-save state
  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved">("idle")
  const autoSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedTextRef = React.useRef<string>("")

  // Track when the draft changes from the server
  React.useEffect(() => {
    lastSavedTextRef.current = row?.currentDraft?.text ?? ""
  }, [row?.id, row?.currentDraft?.id])

  // Auto-save debounce
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

  // Cleanup on review change
  React.useEffect(() => {
    setSaveState("idle")
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }
  }, [row?.id])

  const isReplied = row?.status === "replied"
  const hasText = text.trim().length > 0
  const isDirty = text !== (row?.currentDraft?.text ?? "")
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length

  // Keyboard shortcuts
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
      <div className="flex flex-1 items-center justify-center bg-[#f7f7f8]">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="grid h-20 w-20 place-items-center rounded-full bg-white shadow-sm">
            <InboxIcon className="h-9 w-9 text-slate-300" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold tracking-tight text-slate-400">
              Select a conversation
            </h3>
            <p className="mt-1 max-w-[260px] text-sm text-slate-400/70">
              Choose a review from the feed to start crafting your response.
            </p>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <section className="relative flex h-full min-h-0 flex-col bg-[#f7f7f8]">
        <ScrollArea className="h-full">
          <div ref={scrollRef} className="mx-auto w-full max-w-3xl px-4 pb-52 pt-5 md:px-8 md:pt-8">
            {showMobileBack ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={INBOX_THEME_CLASSES.detailBackButton}
                onClick={onBack}
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
            ) : null}

            <div className="mb-5 flex justify-center">
              <div className={INBOX_THEME_CLASSES.detailLocationChip}>
                <MapPin className="h-3 w-3" />
                {row.location.displayName}
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={`review-${row.id}`}
                variants={bubbleVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="mb-6 flex items-start gap-3"
              >
                <ReviewerAvatar name={row.reviewer.displayName} />
                <div className="min-w-0 max-w-[85%]">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">
                      {row.reviewer.displayName ?? "Anonymous"}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {formatAge(row.createTimeIso)} ago
                    </span>
                  </div>
                  <div className="rounded-2xl rounded-tl-md border border-slate-200/80 bg-white px-5 py-4 shadow-sm">
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
                transition={{ duration: 0.3, delay: 0.15, ease: "easeOut" }}
                className="mb-6 flex items-start justify-end gap-3"
              >
                <div className="min-w-0 max-w-[85%]">
                  <div className="mb-1 flex items-center justify-end gap-2">
                    <span className="text-[11px] text-slate-400">Published reply</span>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" weight="fill" />
                  </div>
                  <div className="rounded-2xl rounded-tr-md border border-blue-100 bg-blue-50/40 px-5 py-4">
                    <p className="text-[15px] font-medium leading-relaxed text-slate-700">
                      {row.reply.comment}
                    </p>
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
                transition={{ duration: 0.3, delay: 0.15, ease: "easeOut" }}
                className="mb-6 flex items-start justify-end gap-3"
              >
                <div className="min-w-0 max-w-[85%]">
                  <div className="mb-1 flex items-center justify-end gap-2">
                    <span className="text-[11px] font-semibold text-slate-400">AI Draft</span>
                  </div>
                  <div className="relative rounded-2xl rounded-tr-md border border-slate-200/60 bg-white px-5 py-4 shadow-sm">
                    {busy === "generate" ? (
                      <div className="flex min-h-[120px] items-center justify-center">
                        <div className="flex flex-col items-center gap-2.5 text-[#007aff]">
                          <Loader2 className="h-6 w-6 animate-spin" />
                          <span className="text-[11px] font-bold uppercase tracking-wider">
                            Generating response
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap text-[15px] font-medium leading-relaxed text-slate-700">
                        {text}
                      </p>
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
              variants={composerVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="absolute inset-x-0 bottom-0 z-30 px-4 pb-5 pt-3 md:px-8"
            >
              <div className="mx-auto max-w-3xl">
                <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-200/60 bg-white/90 px-5 py-3.5 shadow-lg backdrop-blur-xl">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" weight="fill" />
                  <span className="text-sm font-bold tracking-tight text-emerald-600">
                    Published successfully
                  </span>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              variants={composerVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-[#f7f7f8] via-[#f7f7f8] to-transparent px-4 pb-5 pt-8 md:px-8"
            >
              <div className="mx-auto max-w-3xl">
                <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-lg">
                  <div className="px-4 py-3">
                    <Textarea
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      placeholder="Edit your response..."
                      disabled={busy === "generate"}
                      rows={3}
                      className="min-h-[72px] resize-none border-none bg-transparent px-0 text-[15px] font-medium leading-relaxed text-slate-700 shadow-none outline-none ring-0 placeholder:text-slate-400 focus-visible:ring-0"
                    />
                  </div>

                  <div className="flex items-center gap-2 border-t border-slate-100 px-3 py-1.5">
                    <DraftStatusChip status={detail?.currentDraft?.status ?? row.currentDraft?.status ?? row.draftStatus} />
                    {saveState === "saving" && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                        <Loader2 className="h-3 w-3 animate-spin" /> Saving…
                      </span>
                    )}
                    {saveState === "saved" && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-500">
                        <CheckCircle2 className="h-3 w-3" /> Saved
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 border-t border-slate-100 px-3 py-2">
                    <ActionButton
                      tooltip="Generate AI draft"
                      onClick={() =>
                        void runAction("generate", async () => {
                          await onGenerate(row.id)
                        })
                      }
                      disabled={busy !== null}
                      className="text-[#007aff] hover:bg-blue-50 hover:text-[#007aff]"
                    >
                      {busy === "generate" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                    </ActionButton>

                    <ActionButton
                      tooltip="Tone check"
                      onClick={() =>
                        void runAction("verify", async () => {
                          await onVerify(row.id)
                        })
                      }
                      disabled={busy !== null || !hasText}
                      className="text-slate-500 hover:bg-slate-50"
                    >
                      {busy === "verify" ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}
                    </ActionButton>

                    <ActionButton
                      tooltip="Save draft"
                      onClick={() =>
                        void runAction("save", async () => {
                          await onSave(row.id, text)
                        })
                      }
                      disabled={busy !== null || !hasText || !isDirty}
                      className="text-slate-500 hover:bg-slate-50"
                    >
                      {busy === "save" ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                    </ActionButton>

                    <ActionButton
                      tooltip="Copy draft"
                      onClick={() => void copyDraft()}
                      disabled={!hasText}
                      className="text-slate-500 hover:bg-slate-50"
                    >
                      <Copy className="h-4 w-4" />
                    </ActionButton>

                    <span className="ml-auto hidden items-center gap-2 text-[11px] font-semibold tabular-nums text-slate-400 md:inline-flex">
                      {wordCount} {wordCount === 1 ? "word" : "words"}
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-300">⌘↵ publish</span>
                    </span>

                    <ActionButton
                      tooltip="Publish reply"
                      onClick={() =>
                        void runAction("publish", async () => {
                          await onPublish(row.id, text, row)
                        })
                      }
                      disabled={busy !== null || !hasText}
                      className="ml-1 bg-[#007aff] text-white hover:bg-blue-600 hover:text-white"
                    >
                      {busy === "publish" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </ActionButton>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </TooltipProvider>
  )
}
