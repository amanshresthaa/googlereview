import * as React from "react"
import { toast } from "sonner"

import { Stars } from "./Stars"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { CheckCircle2, ChevronRight, Clock, RefreshCw, Send, Sparkles, Zap } from "@/components/icons"

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
  const progress = totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 100

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
        <div className="h-1.5 bg-muted">
          <div className="h-full w-full bg-primary" />
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <Card className="w-full max-w-md">
            <CardContent className="space-y-4 p-6 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">Blitz complete</p>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Queue cleared</h2>
              <p className="text-sm text-muted-foreground">No pending reviews in this queue.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!currentReview) {
    return null
  }

  const reviewerName = currentReview.reviewer.displayName || "Anonymous"

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="border-b bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:p-5">
        <div className="mx-auto w-full max-w-3xl space-y-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Zap className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Quick Reply Blitz</p>
                <p className="text-xs text-muted-foreground">Fast queue processing</p>
              </div>
            </div>

            <Badge variant="outline" className="rounded-full">
              {processedCount + 1} / {Math.max(totalCount, 1)}
            </Badge>
          </div>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="mx-auto w-full max-w-3xl space-y-4 p-4 md:space-y-6 md:p-6">
          <Card>
            <CardHeader className="space-y-4 pb-3">
              <div className="flex items-start gap-3">
                <Avatar className="h-12 w-12 border border-border/70">
                  <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                    {getInitials(reviewerName)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="truncate text-lg">{reviewerName}</CardTitle>
                    <Badge variant="outline" className="rounded-full text-[11px]">
                      {currentReview.location.displayName}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Stars rating={currentReview.starRating} size="sm" />
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      Pending review
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <blockquote className="rounded-xl border bg-muted/25 p-4 text-base leading-relaxed text-foreground md:text-lg">
                &quot;{currentReview.comment || "No written review text provided."}&quot;
              </blockquote>

              <div className="space-y-3 rounded-xl border bg-muted/25 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">Draft Console</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8"
                    onClick={handleGenerate}
                    disabled={busy !== null}
                  >
                    {busy === "generate" ? (
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {hasDraft ? "Regenerate" : "Generate"}
                  </Button>
                </div>

                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Generate or write a response..."
                  className={cn(
                    "min-h-[180px] resize-none text-sm leading-relaxed",
                    busy === "generate" && "pointer-events-none opacity-60",
                  )}
                />

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{draft.trim().split(/\s+/).filter(Boolean).length} words</span>
                  <span>{draft.length} characters</span>
                  {currentReview.draftStatus === "READY" ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Verified
                    </span>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      <footer className="border-t bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:p-4">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary" className="rounded-full">
              {queue.length} left
            </Badge>
            <span>Blitz session active</span>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
            <Button type="button" variant="ghost" className="h-10" onClick={handleSkip}>
              <ChevronRight className="mr-1.5 h-4 w-4" />
              Skip
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-10"
              onClick={handleSave}
              disabled={!hasDraft || !isDirty || busy !== null}
            >
              {busy === "save" ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>

            <Button
              type="button"
              className="h-10"
              onClick={handlePublishNext}
              disabled={!hasDraft || busy !== null}
            >
              {busy === "publish" ? (
                <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-1.5 h-4 w-4" />
              )}
              Publish & Next
            </Button>
          </div>
        </div>
      </footer>
    </div>
  )
}
