"use client"

import * as React from "react"
import { Activity, AlertTriangle } from "lucide-react"

type Summary = {
  byType: Record<
    string,
    { pending: number; running: number; retrying: number; failed_24h: number }
  >
  recentFailures: Array<{ id: string; type: string; completedAtIso: string | null; lastError: string | null }>
}

function sumBacklog(byType: Summary["byType"]) {
  return Object.values(byType).reduce(
    (acc, r) => acc + r.pending + r.running + r.retrying,
    0
  )
}

export function JobHealthWidget(props: { pollMs?: number }) {
  const pollMs = props.pollMs ?? 15_000
  const [summary, setSummary] = React.useState<Summary | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const fetchOnce = React.useCallback(async () => {
    try {
      const res = await fetch("/api/jobs/summary", { method: "GET" })
      if (!res.ok) throw new Error(await res.text())
      const json = (await res.json()) as { summary: Summary }
      setSummary(json.summary)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  React.useEffect(() => {
    fetchOnce()
    const t = setInterval(fetchOnce, pollMs)
    return () => clearInterval(t)
  }, [fetchOnce, pollMs])

  if (error) {
    return (
      <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Job health unavailable.
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Loading job health...
      </div>
    )
  }

  const backlog = sumBacklog(summary.byType)
  const failed24h = Object.values(summary.byType).reduce((acc, r) => acc + r.failed_24h, 0)

  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Activity className="size-3.5" />
          <span>Background</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">backlog</span>
          <span className="font-medium">{backlog}</span>
          <span className="text-muted-foreground">failed 24h</span>
          <span className={failed24h ? "font-medium text-destructive" : "font-medium"}>
            {failed24h}
          </span>
          {failed24h ? <AlertTriangle className="size-3.5 text-destructive" /> : null}
        </div>
      </div>
    </div>
  )
}

