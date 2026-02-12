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

  const handleGenerate = () => {
    if (!currentReview) return
    void run("generate", async () => {
      await onGenerate(currentReview.id)
    })
  }

  const handleSave = () => {
    if (!currentReview || !hasDraft) return
    void run("save", async () => {
      await onSave(currentReview.id, draft)
    })
  }

  const handleSkip = () => {
    if (!currentReview) return
    completeCurrent(currentReview.id)
  }

  const handlePublishNext = () => {
    if (!currentReview || !hasDraft) return

    void run("publish", async () => {
      await onPublish(currentReview.id, draft, currentReview)
      completeCurrent(currentReview.id)
    })
  }

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
          <h2 className="text-3xl font-black tracking-tight text-foreground">Queue Cleared!</h2>
          <p className="mt-2 text-sm font-medium text-muted-foreground max-w-xs leading-relaxed">
            Fantastic work. You&apos;ve responded to all pending reviews in this session.
          </p>
          <Button onClick={() => window.location.reload()} className="mt-10 h-12 rounded-2xl px-10 font-black shadow-glow-primary">
            Return to Inbox
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
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-glow-primary">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight">Blitz Session</h1>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-32 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full bg-primary"
                    animate={{ width: `${progress}%` }}
                    transition={{ type: "spring", stiffness: 50, damping: 20 }}
                  />
                </div>
                <span className="text-[10px] font-black tabular-nums text-muted-foreground">{Math.round(progress)}%</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="rounded-full border-border/50 bg-muted/30 px-3 py-1 text-[10px] font-black uppercase tracking-widest tabular-nums">
              {processedCount + 1} / {totalCount}
            </Badge>
          </div>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-10">
          <div className="flex items-start gap-5">
            <Avatar className="h-14 w-14 border-2 border-primary/5 shadow-sm">
              <AvatarFallback className="bg-primary/5 text-xl font-bold text-primary">
                {getInitials(reviewerName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-2xl font-black tracking-tight text-foreground truncate">{reviewerName}</h2>
                <Stars rating={currentReview.starRating} size="sm" />
              </div>
              <div className="flex items-center gap-3 mt-1 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" />
                  {currentReview.location.displayName}
                </div>
                <span>•</span>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  Pending Response
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="relative p-8 rounded-[32px] bg-muted/20 border border-border/50 shadow-inner">
              <div className="absolute -left-3 top-10 h-12 w-1 rounded-full bg-primary/20" />
              <p className="text-xl md:text-2xl leading-relaxed text-foreground font-medium italic">
                &ldquo;{currentReview.comment || "No review text provided."}&rdquo;
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Response Console</h3>
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
                      <RefreshCw className="mr-1.5 h-3 w-3" />
                    </motion.div>
                  ) : (
                    <Sparkles className="mr-1.5 h-3 w-3" />
                  )}
                  {hasDraft ? "Regenerate AI" : "Generate AI"}
                </Button>
              </div>

              <div className="relative group">
                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Draft your response here..."
                  className={cn(
                    "min-h-[240px] rounded-[24px] border-border/50 bg-background p-8 text-lg leading-relaxed shadow-sm transition-all focus:ring-4 focus:ring-primary/5",
                    busy === "generate" && "opacity-50 pointer-events-none",
                  )}
                />
                <AnimatePresence>
                  {busy === "generate" && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-10 rounded-[24px] bg-background/40 backdrop-blur-sm flex items-center justify-center"
                    >
                      <motion.div
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="flex flex-col items-center gap-3 text-primary"
                      >
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <RefreshCw className="h-8 w-8" />
                        </motion.div>
                        <p className="text-xs font-black uppercase tracking-widest">Generating AI Response</p>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {currentReview.draftStatus === "READY" && (
                  <div className="absolute top-4 right-4">
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[9px] font-black uppercase tracking-widest shadow-sm">
                      <ShieldCheck className="h-3 w-3" /> Verified
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      <footer className="border-t border-border/50 bg-background/80 glass-sm p-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <Button
            type="button"
            variant="ghost"
            className="h-12 px-6 rounded-2xl font-bold text-muted-foreground hover:bg-muted/80"
            onClick={handleSkip}
          >
            Skip Review
          </Button>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-12 px-6 rounded-2xl font-bold border-border/50 bg-background shadow-sm hover:bg-muted/50"
              onClick={handleSave}
              disabled={!hasDraft || !isDirty || busy !== null}
            >
              {busy === "save" ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                </motion.div>
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save
            </Button>

            <Button
              type="button"
              className="h-12 px-10 rounded-2xl bg-primary font-black shadow-glow-primary transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              onClick={handlePublishNext}
              disabled={!hasDraft || busy !== null}
            >
              {busy === "publish" ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                  <RefreshCw className="mr-2 h-5 w-5" />
                </motion.div>
              ) : (
                <Send className="mr-2 h-5 w-5" />
              )}
              Post & Continue
            </Button>
          </div>
        </div>
      </footer>
    </div>
  )
}


