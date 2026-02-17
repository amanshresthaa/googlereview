"use client"

import * as React from "react"
import Link from "next/link"
import { useJobSummaryPolling } from "@/lib/hooks"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2 } from "@/components/icons"
import { cn } from "@/lib/utils"

export function JobHealthWidget({ compact = false }: { compact?: boolean }) {
  const { summary, backlog, failed24h, error } = useJobSummaryPolling(60_000)
  const [open, setOpen] = React.useState(false)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [detailError, setDetailError] = React.useState<string | null>(null)
  const [detailSummary, setDetailSummary] = React.useState<typeof summary>(null)

  React.useEffect(() => {
    if (!open) return
    if (detailSummary) return

    let mounted = true
    const controller = new AbortController()

    setDetailLoading(true)
    setDetailError(null)
    void (async () => {
      try {
        const res = await fetch("/api/jobs/summary?detail=1", { signal: controller.signal })
        if (!mounted) return
        if (!res.ok) {
          setDetailError(res.statusText)
          return
        }
        const data = await res.json()
        setDetailSummary(data.summary ?? null)
      } catch (err: unknown) {
        if (!mounted) return
        if (err instanceof DOMException && err.name === "AbortError") return
        setDetailError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        if (mounted) setDetailLoading(false)
      }
    })()

    return () => {
      mounted = false
      controller.abort()
    }
  }, [open, detailSummary])

  const effectiveSummary = detailSummary ?? summary
  const aiQuality = effectiveSummary?.aiQuality24h

  const label = error
    ? "Unavailable"
    : failed24h > 0
      ? `${failed24h} failed`
      : backlog > 0
        ? `${backlog} queued`
        : "All clear"

  const hasIssue = error || failed24h > 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "app-action-secondary w-full rounded-xl border border-transparent px-1.5 py-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring",
            compact && "px-0"
          )}
        >
          {hasIssue ? (
            <div className="size-6 rounded-md bg-destructive/10 grid place-items-center shrink-0">
              <AlertTriangle className="size-3 text-destructive" />
            </div>
          ) : backlog > 0 ? (
            <div className="size-6 rounded-md bg-primary/10 grid place-items-center shrink-0">
              <Loader2 className="size-3 text-primary animate-spin" />
            </div>
          ) : (
            <div className="size-6 rounded-md bg-success/10 grid place-items-center shrink-0">
              <CheckCircle2 className="size-3 text-success" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold leading-none">Jobs</div>
            <div className="text-[9px] text-muted-foreground truncate mt-0.5">{label}</div>
          </div>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg rounded-2xl border-shell-foreground/10 bg-shell-foreground/10">
        <DialogHeader>
          <DialogTitle className="text-base">System Health</DialogTitle>
          <DialogDescription className="text-xs">
            Worker queue status and recent failures
          </DialogDescription>
        </DialogHeader>

        {detailLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading details...
          </div>
        ) : detailError ? (
          <div className="text-xs text-destructive">Failed to load details: {detailError}</div>
        ) : null}

        <div className={cn("grid gap-3", aiQuality ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2")}>
          <Card className="app-pane-card rounded-xl border-shell-foreground/10 p-4 shadow-card">
            <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Backlog</div>
            <div className="mt-1.5 text-2xl font-bold tabular-nums">{backlog}</div>
          </Card>
          <Card className="app-pane-card rounded-xl border-shell-foreground/10 p-4 shadow-card">
            <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Failed (24h)</div>
            <div className={cn("mt-1.5 text-2xl font-bold tabular-nums", failed24h > 0 && "text-destructive")}>{failed24h}</div>
          </Card>
          {aiQuality ? (
            <Card className="app-pane-card rounded-xl border-shell-foreground/10 p-4 shadow-card">
              <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">SEO Coverage</div>
              <div className="mt-1.5 text-2xl font-bold tabular-nums">{(aiQuality.avgKeywordCoverage * 100).toFixed(0)}%</div>
            </Card>
          ) : null}
          {aiQuality ? (
            <Card className="app-pane-card rounded-xl border-shell-foreground/10 p-4 shadow-card">
              <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Stuffing Risk</div>
              <div className={cn("mt-1.5 text-2xl font-bold tabular-nums", aiQuality.stuffingRisk > 0 && "text-destructive")}>
                {(aiQuality.stuffingRiskRate * 100).toFixed(1)}%
              </div>
            </Card>
          ) : null}
        </div>
        {aiQuality?.topProgramVersion ? (
          <div className="text-[11px] text-muted-foreground">
            Active DSPy program: <span className="font-mono">{aiQuality.topProgramVersion}</span>
          </div>
        ) : null}

        {effectiveSummary?.recentFailures?.length ? (
          <div className="space-y-2">
            <div className="text-xs font-semibold">Recent Failures</div>
            <div className="max-h-[250px] overflow-auto scrollbar-thin space-y-1.5">
              {effectiveSummary.recentFailures.slice(0, 8).map((f) => (
                <Card key={f.id} className="app-pane-card rounded-lg border-shell-foreground/10 p-3 shadow-card">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="secondary" className="rounded-md text-[10px] h-5 px-1.5">{f.type}</Badge>
                    <span className="text-[9px] text-muted-foreground font-mono truncate max-w-[120px]">{f.id}</span>
                  </div>
                  {f.lastError && (
                    <p className="mt-1.5 text-[11px] text-muted-foreground whitespace-pre-wrap break-words leading-relaxed">
                      {f.lastError}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-muted p-6 text-center">
            <CheckCircle2 className="size-5 text-success mx-auto mb-1.5" />
            <p className="text-xs text-muted-foreground">No failures recorded</p>
          </div>
        )}

        <div className="flex justify-end">
          <Button asChild variant="secondary" className="app-action-secondary rounded-lg border-shell-foreground/10">
            <Link href="/system-health">
              <ExternalLink className="size-4" />
              <span className="ml-2">View details</span>
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
