"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"

import { Stars } from "./Stars"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { CheckCircle2, Clock, MapPin, RefreshCw, Save, Send, ShieldCheck, Sparkles, Zap } from "@/components/icons"

import type { ReviewRow } from "@/lib/hooks"

type BlitzQuickReplyProps = {
  pendingRows: ReviewRow[]
  focusReviewId?: string | null
  onGenerate: (reviewId: string) => Promise<void>
  onSave: (reviewId: string, text: string) => Promise<void>
  onPublish: (reviewId: string, text: string, row: ReviewRow) => Promise<void>
}

type BusyState = null | "generate" | "save" | "publish"

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? "?"
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : ""
  return `${first}${last}`.toUpperCase()
}

export function BlitzQuickReply({ pendingRows, focusReviewId, onGenerate, onSave, onPublish }: BlitzQuickReplyProps) {
  const [dismissedIds, setDismissedIds] = React.useState<string[]>([])
  const [currentIndex, setCurrentIndex] = React.useState(0)
  const [draft, setDraft] = React.useState("")
  const [busy, setBusy] = React.useState<BusyState>(null)

  const queue = React.useMemo(() => {
    return pendingRows.filter((row) => !dismissedIds.includes(row.id))
  }, [dismissedIds, pendingRows])

  React.useEffect(() => {
    if (queue.length === 0) {
      setCurrentIndex(0)
      return
    }

    if (!focusReviewId) {
      setCurrentIndex((prev) => Math.min(prev, queue.length - 1))
      return
    }

    const nextIndex = queue.findIndex((row) => row.id === focusReviewId)
    if (nextIndex >= 0) {
      setCurrentIndex(nextIndex)
      return
    }

    setCurrentIndex((prev) => Math.min(prev, queue.length - 1))
  }, [focusReviewId, queue])

  const currentReview = queue[currentIndex] ?? null

  React.useEffect(() => {
    setDraft(currentReview?.currentDraft?.text ?? "")
  }, [currentReview?.id, currentReview?.currentDraft?.id, currentReview?.currentDraft?.text])

  const totalCount = queue.length + dismissedIds.length
  const processedCount = dismissedIds.length
  const progress = totalCount > 0 ? (processedCount / totalCount) * 100 : 100

  const hasDraft = draft.trim().length > 0
  const isDirty = draft !== (currentReview?.currentDraft?.text ?? "")

  const completeCurrent = React.useCallback((reviewId: string) => {
    setDismissedIds((prev) => (prev.includes(reviewId) ? prev : [...prev, reviewId]))
    setCurrentIndex((prev) => Math.max(prev - 1, 0))
  }, [])

  const run = async (action: NonNullable<BusyState>, fn: () => Promise<void>) => {
    setBusy(action)
    try {
      await fn()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed")
    } finally {
      setBusy(null)
    }
  }

  const handleGenerate = React.useCallback(() => {
    if (!currentReview) return
    void run("generate", async () => {
      await onGenerate(currentReview.id)
    })
  }, [currentReview, onGenerate])

  const handleSave = React.useCallback(() => {
    if (!currentReview || !hasDraft) return
    void run("save", async () => {
      await onSave(currentReview.id, draft)
    })
  }, [currentReview, hasDraft, onSave, draft])

  const handleSkip = React.useCallback(() => {
    if (!currentReview) return
    completeCurrent(currentReview.id)
  }, [currentReview, completeCurrent])

  const handlePublishNext = React.useCallback(() => {
    if (!currentReview || !hasDraft) return

    void run("publish", async () => {
      await onPublish(currentReview.id, draft, currentReview)
      completeCurrent(currentReview.id)
    })
  }, [currentReview, hasDraft, onPublish, draft, completeCurrent])

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "Enter") {
        e.preventDefault()
        handlePublishNext()
      }
      if (e.metaKey && e.key === "s") {
        e.preventDefault()
        handleSave()
      }
      if (e.key === "Escape") {
        e.preventDefault()
        handleSkip()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handlePublishNext, handleSave, handleSkip])

  if (queue.length === 0) {
    return (
      <div className="flex h-full flex-col bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex-1 flex flex-col items-center justify-center p-8 text-center"
        >
          <div className="relative mb-8">
            <motion.div
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 rounded-full bg-emerald-500/10 blur-2xl"
            />
            <div className="relative h-24 w-24 bg-background shadow-card rounded-[32px] flex items-center justify-center border border-emerald-500/20 text-emerald-600 transition-transform duration-500 hover:rotate-12">
              <CheckCircle2 className="h-12 w-12" />
            </div>
          </div>
          <h2 className="text-3xl font-black tracking-tight text-foreground">Session Complete</h2>
          <p className="mt-2 text-sm font-medium text-muted-foreground max-w-xs leading-relaxed">
            All reviews in this queue have been processed. Great job staying on top of your customer feedback.
          </p>
          <Button onClick={() => window.location.reload()} className="mt-10 h-12 rounded-2xl px-10 font-black shadow-glow-primary">
            Back to Inbox
          </Button>
        </motion.div>
      </div>
    )
  }

  if (!currentReview) return null

  const reviewerName = currentReview.reviewer.displayName || "Anonymous"

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="border-b border-border/50 bg-background/80 glass-sm px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-glow-primary">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight uppercase tracking-[0.1em]">Blitz Mode</h1>
              <div className="flex items-center gap-3">
                <div className="h-1.5 w-32 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full bg-primary"
                    animate={{ width: `${progress}%` }}
                    transition={{ type: "spring", stiffness: 50, damping: 20 }}
                  />
                </div>
                <span className="text-[10px] font-black tabular-nums text-muted-foreground">{Math.round(progress)}% COMPLETE</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="rounded-full border-border/50 bg-muted/30 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest tabular-nums">
              Review {processedCount + 1} of {totalCount}
            </Badge>
          </div>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-10">
          <div className="flex items-start gap-6">
            <Avatar className="h-16 w-16 border-2 border-primary/5 shadow-sm shrink-0">
              <AvatarFallback className="bg-primary/5 text-xl font-bold text-primary">
                {getInitials(reviewerName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-2xl font-black tracking-tight text-foreground truncate">{reviewerName}</h2>
                <Stars rating={currentReview.starRating} size="md" />
              </div>
              <div className="flex items-center gap-4 mt-1 text-[11px] font-black text-muted-foreground uppercase tracking-widest">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {currentReview.location.displayName}
                </div>
                <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Pending Response
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-10">
            <div className="relative p-10 rounded-[40px] bg-muted/20 border border-border/50 shadow-inner group">
              <div className="absolute -left-3 top-12 h-20 w-1 rounded-full bg-primary/20 transition-all group-hover:bg-primary/40" />
              <p className="text-2xl md:text-3xl leading-relaxed text-foreground font-medium italic">
                &ldquo;{currentReview.comment || "No review text provided."}&rdquo;
              </p>
            </div>

            <div className="space-y-5">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Response Dashboard</h3>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-widest hidden sm:inline">
                    ⌘ + Enter to Publish
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 rounded-lg text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5"
                    onClick={handleGenerate}
                    disabled={busy !== null}
                  >
                    {busy === "generate" ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      </motion.div>
                    ) : (
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {hasDraft ? "Regenerate" : "Start AI Draft"}
                  </Button>
                </div>
              </div>

              <div className="relative group">
                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Draft your response here..."
                  className={cn(
                    "min-h-[280px] rounded-[32px] border-border/50 bg-background p-10 text-xl leading-relaxed shadow-sm transition-all focus:ring-8 focus:ring-primary/5",
                    busy === "generate" && "opacity-50 pointer-events-none",
                  )}
                />
                <AnimatePresence>
                  {busy === "generate" && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-10 rounded-[32px] bg-background/60 backdrop-blur-md flex items-center justify-center"
                    >
                      <motion.div
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="flex flex-col items-center gap-4 text-primary"
                      >
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <RefreshCw className="h-10 w-10" />
                        </motion.div>
                        <p className="text-xs font-black uppercase tracking-[0.2em]">Analyzing Feedback</p>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {currentReview.draftStatus === "READY" && (
                  <div className="absolute top-6 right-6">
                    <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase tracking-widest shadow-sm border border-emerald-500/10">
                      <ShieldCheck className="h-4 w-4" /> AI Verified
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      <footer className="border-t border-border/50 bg-background/80 glass-sm p-6 md:p-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-6">
          <Button
            type="button"
            variant="ghost"
            className="h-14 px-8 rounded-2xl font-black text-muted-foreground/60 hover:bg-muted transition-all uppercase tracking-widest text-[11px]"
            onClick={handleSkip}
          >
            Skip (Esc)
          </Button>

          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              className="h-14 px-10 rounded-2xl font-black border-border/50 bg-background shadow-sm hover:bg-muted/50 transition-all uppercase tracking-widest text-[11px] hidden sm:flex"
              onClick={handleSave}
              disabled={!hasDraft || !isDirty || busy !== null}
            >
              {busy === "save" ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                  <RefreshCw className="h-5 w-5 mr-3" />
                </motion.div>
              ) : (
                <Save className="h-5 w-5 mr-3" />
              )}
              Save Draft
            </Button>

            <Button
              type="button"
              className="h-14 px-12 rounded-2xl bg-primary font-black shadow-glow-primary transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 uppercase tracking-[0.15em] text-[11px]"
              onClick={handlePublishNext}
              disabled={!hasDraft || busy !== null}
            >
              {busy === "publish" ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                  <RefreshCw className="mr-3 h-5 w-5" />
                </motion.div>
              ) : (
                <Send className="mr-3 h-5 w-5" />
              )}
              Post & Continue
            </Button>
          </div>
        </div>
      </footer>
    </div>
  )
}
