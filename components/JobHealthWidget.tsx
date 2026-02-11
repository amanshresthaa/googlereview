"use client"

import * as React from "react"
import { useJobSummaryPolling } from "@/lib/hooks"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertTriangle, CheckCircle2, Loader2 } from "@/components/icons"
import { cn } from "@/lib/utils"

export function JobHealthWidget({ compact = false }: { compact?: boolean }) {
  const { summary, backlog, failed24h, error } = useJobSummaryPolling(20_000)
  const aiQuality = summary?.aiQuality24h

  const label = error
    ? "Unavailable"
    : failed24h > 0
      ? `${failed24h} failed`
      : backlog > 0
        ? `${backlog} queued`
        : "All clear"

  const hasIssue = error || failed24h > 0

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "w-full flex items-center gap-2 text-left py-1.5 px-1.5 rounded-lg transition-colors hover:bg-muted/60 outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
            <div className="size-6 rounded-md bg-emerald-500/10 grid place-items-center shrink-0">
              <CheckCircle2 className="size-3 text-emerald-500" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold leading-none">Jobs</div>
            <div className="text-[9px] text-muted-foreground truncate mt-0.5">{label}</div>
          </div>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-base">System Health</DialogTitle>
          <DialogDescription className="text-xs">
            Worker queue status and recent failures
          </DialogDescription>
        </DialogHeader>

        <div className={cn("grid gap-3", aiQuality ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2")}>
          <Card className="rounded-xl p-4 shadow-card">
            <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Backlog</div>
            <div className="mt-1.5 text-2xl font-bold tabular-nums">{backlog}</div>
          </Card>
          <Card className="rounded-xl p-4 shadow-card">
            <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Failed (24h)</div>
            <div className={cn("mt-1.5 text-2xl font-bold tabular-nums", failed24h > 0 && "text-destructive")}>{failed24h}</div>
          </Card>
          {aiQuality ? (
            <Card className="rounded-xl p-4 shadow-card">
              <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">SEO Coverage</div>
              <div className="mt-1.5 text-2xl font-bold tabular-nums">{(aiQuality.avgKeywordCoverage * 100).toFixed(0)}%</div>
            </Card>
          ) : null}
          {aiQuality ? (
            <Card className="rounded-xl p-4 shadow-card">
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

        {summary?.recentFailures?.length ? (
          <div className="space-y-2">
            <div className="text-xs font-semibold">Recent Failures</div>
            <div className="max-h-[250px] overflow-auto scrollbar-thin space-y-1.5">
              {summary.recentFailures.slice(0, 8).map((f) => (
                <Card key={f.id} className="rounded-lg p-3 shadow-card">
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
            <CheckCircle2 className="size-5 text-emerald-500 mx-auto mb-1.5" />
            <p className="text-xs text-muted-foreground">No failures recorded</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
