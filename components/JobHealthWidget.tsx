"use client"

import * as React from "react"
import { Activity, AlertTriangle, ChevronDown } from "lucide-react"
import { useJobSummaryPolling } from "@/lib/hooks"

function timeAgo(iso: string | null) {
  if (!iso) return "unknown"
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

export function JobHealthWidget({ pollMs }: { pollMs?: number }) {
  const { summary, backlog, failed24h, error } = useJobSummaryPolling(pollMs)
  const [open, setOpen] = React.useState(false)

  if (error) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
        <Activity className="size-3" />Health unavailable
      </span>
    )
  }

  if (!summary) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
        <span className="size-2 animate-pulse rounded-full bg-muted-foreground/50" />Loading…
      </span>
    )
  }

  const hasFailures = failed24h > 0
  const hasBacklog = backlog > 0
  const dotColor = hasFailures ? "bg-destructive" : hasBacklog ? "bg-amber-500" : "bg-green-500"
  const label = hasFailures ? `${failed24h} failed` : hasBacklog ? `${backlog} queued` : "All clear"
  const failures = summary.recentFailures ?? []

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs transition-colors hover:bg-muted/70"
      >
        <span className={`size-2 rounded-full ${dotColor}`} />
        {hasFailures && <AlertTriangle className="size-3 text-destructive" />}
        <span>{label}</span>
        {failures.length > 0 && (
          <ChevronDown className={`size-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </button>

      {open && failures.length > 0 && (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-lg border border-border bg-popover p-2 shadow-md">
          <p className="mb-1 text-[11px] font-medium text-muted-foreground">Recent failures</p>
          <ul className="space-y-1">
            {failures.slice(0, 5).map((f) => (
              <li key={f.id} className="rounded-md bg-destructive/5 px-2 py-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-destructive">{f.type}</span>
                  <span className="text-muted-foreground">{timeAgo(f.completedAtIso)}</span>
                </div>
                {f.lastError && (
                  <p className="mt-0.5 truncate text-muted-foreground">{f.lastError.slice(0, 80)}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
