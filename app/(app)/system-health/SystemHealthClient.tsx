"use client"

import * as React from "react"
import { toast } from "sonner"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowRight, RefreshCw, Zap } from "@/components/icons"
import { withIdempotencyHeader } from "@/lib/api/client-idempotency"
import { cn } from "@/lib/utils"
import { EnqueuePanel, type EnabledLocation } from "@/app/(app)/system-health/components/EnqueuePanel"
import { JobDetailSheet } from "@/app/(app)/system-health/components/JobDetailSheet"
import { JobFilters, type FilterOption } from "@/app/(app)/system-health/components/JobFilters"
import { JobTable, type JobListItem } from "@/app/(app)/system-health/components/JobTable"

type Summary = {
  pending: number
  running: number
  retrying: number
  backlog: number
  failed24h: number
}

type JobListResponse = {
  jobs: JobListItem[]
  nextCursor: string | null
}

type JobsSummaryResponse = {
  summary?: {
    byType?: Record<string, { pending: number; running: number; retrying: number; failed_24h: number }>
  }
}

const STATUS_OPTIONS_BACKLOG: FilterOption[] = [
  { value: "PENDING", label: "Pending" },
  { value: "RUNNING", label: "Running" },
  { value: "RETRYING", label: "Retrying" },
]

const STATUS_OPTIONS_COMPLETED: FilterOption[] = [
  { value: "COMPLETED", label: "Completed" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
]

const TYPE_OPTIONS: FilterOption[] = [
  { value: "SYNC_LOCATIONS", label: "Google account/location sync" },
  { value: "SYNC_REVIEWS", label: "Review sync per location" },
  { value: "PROCESS_REVIEW", label: "Draft generation/verification" },
  { value: "POST_REPLY", label: "Posting replies to Google" },
]

function buildJobsUrl(input: {
  order: "RUN_AT_ASC" | "COMPLETED_AT_DESC"
  statuses: Set<string>
  types: Set<string>
  q: string
  staleOnly?: boolean
  cursor?: string | null
  limit: number
}) {
  const params = new URLSearchParams()
  params.set("order", input.order)
  params.set("limit", String(input.limit))
  if (input.cursor) params.set("cursor", input.cursor)
  if (input.q.trim()) params.set("q", input.q.trim())
  if (input.staleOnly) params.set("stale", "1")
  for (const s of input.statuses) params.append("status", s)
  for (const t of input.types) params.append("type", t)
  return `/api/jobs?${params.toString()}`
}

async function fetchJson<T>(url: string, init?: RequestInit) {
  const res = await fetch(url, init)
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    const message = typeof json?.error === "string" ? json.error : res.statusText
    throw new Error(message || "Request failed")
  }
  return json as T
}

function sumSummary(summary: JobsSummaryResponse["summary"] | undefined) {
  const byType = summary?.byType ?? {}
  let pending = 0
  let running = 0
  let retrying = 0
  let failed24h = 0
  for (const row of Object.values(byType)) {
    pending += Number(row.pending ?? 0)
    running += Number(row.running ?? 0)
    retrying += Number(row.retrying ?? 0)
    failed24h += Number(row.failed_24h ?? 0)
  }
  return { pending, running, retrying, backlog: pending + running + retrying, failed24h }
}

export function SystemHealthClient(props: {
  role: string
  workerDisabled: boolean
  initialNowIso: string
  summary: Summary
  initialBacklog: JobListResponse
  initialCompleted: JobListResponse
  enabledLocations: EnabledLocation[]
}) {
  const isOwner = props.role === "OWNER"

  const [summary, setSummary] = React.useState<Summary>(props.summary)
  const [nowIso, setNowIso] = React.useState<string>(props.initialNowIso)
  const [activeTab, setActiveTab] = React.useState<"backlog" | "completed">("backlog")
  const [staleOnly, setStaleOnly] = React.useState(false)

  const [detailOpen, setDetailOpen] = React.useState(false)
  const [detailJobId, setDetailJobId] = React.useState<string | null>(null)

  const [backlogJobs, setBacklogJobs] = React.useState<JobListItem[]>(props.initialBacklog.jobs)
  const [backlogCursor, setBacklogCursor] = React.useState<string | null>(props.initialBacklog.nextCursor)
  const [completedJobs, setCompletedJobs] = React.useState<JobListItem[]>(props.initialCompleted.jobs)
  const [completedCursor, setCompletedCursor] = React.useState<string | null>(props.initialCompleted.nextCursor)

  const [backlogStatuses, setBacklogStatuses] = React.useState<Set<string>>(() => new Set(STATUS_OPTIONS_BACKLOG.map((o) => o.value)))
  const [completedStatuses, setCompletedStatuses] = React.useState<Set<string>>(() => new Set(STATUS_OPTIONS_COMPLETED.map((o) => o.value)))
  const [types, setTypes] = React.useState<Set<string>>(() => new Set())
  const [q, setQ] = React.useState("")

  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [enqueueLoading, setEnqueueLoading] = React.useState(false)
  const [workerLoading, setWorkerLoading] = React.useState(false)

  const qDebounced = useDebouncedValue(q, 250)
  const didMountRef = React.useRef(false)

  const toggleSet = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, value: string) => {
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  const resetFilters = () => {
    setTypes(new Set())
    setQ("")
    setStaleOnly(false)
    setBacklogStatuses(new Set(STATUS_OPTIONS_BACKLOG.map((o) => o.value)))
    setCompletedStatuses(new Set(STATUS_OPTIONS_COMPLETED.map((o) => o.value)))
  }

  const applyStuckPreset = () => {
    setActiveTab("backlog")
    setQ("")
    setTypes(new Set())
    setBacklogStatuses(new Set(["RUNNING"]))
    setStaleOnly(true)
  }

  const refreshSummary = React.useCallback(async () => {
    const data = await fetchJson<JobsSummaryResponse>("/api/jobs/summary")
    setSummary(sumSummary(data.summary))
  }, [])

  const refreshTab = React.useCallback(
    async (tab: "backlog" | "completed") => {
      setLoading(true)
      setError(null)
      try {
        if (tab === "backlog") {
          const effectiveStaleOnly = staleOnly && backlogStatuses.size === 1 && backlogStatuses.has("RUNNING")
          const url = buildJobsUrl({
            order: "RUN_AT_ASC",
            statuses: backlogStatuses,
            types,
            q: qDebounced,
            staleOnly: effectiveStaleOnly,
            limit: 50,
          })
          const page = await fetchJson<JobListResponse>(url)
          setBacklogJobs(page.jobs)
          setBacklogCursor(page.nextCursor)
        } else {
          const url = buildJobsUrl({
            order: "COMPLETED_AT_DESC",
            statuses: completedStatuses,
            types,
            q: qDebounced,
            limit: 50,
          })
          const page = await fetchJson<JobListResponse>(url)
          setCompletedJobs(page.jobs)
          setCompletedCursor(page.nextCursor)
        }
        setNowIso(new Date().toISOString())
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load jobs")
      } finally {
        setLoading(false)
      }
    },
    [backlogStatuses, completedStatuses, qDebounced, staleOnly, types],
  )

  const refreshAll = React.useCallback(async () => {
    await Promise.all([refreshSummary(), refreshTab(activeTab)])
  }, [activeTab, refreshSummary, refreshTab])

  React.useEffect(() => {
    // Avoid re-fetching immediately on mount: we already rendered server-fetched initial data.
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    void refreshTab(activeTab)
  }, [qDebounced, types, backlogStatuses, completedStatuses, staleOnly, activeTab, refreshTab])

  const runWorkerNow = async (limit: number) => {
    if (!isOwner) return
    if (props.workerDisabled) {
      toast.error("Worker execution is disabled for this deployment.")
      return
    }

    setWorkerLoading(true)
    setError(null)
    try {
      const res = await fetchJson<{ worker?: { claimed?: number; results?: Array<{ id: string; ok: boolean; error?: string }> } }>(
        "/api/jobs/worker/run",
        {
          method: "POST",
          headers: withIdempotencyHeader({ "content-type": "application/json" }),
          body: JSON.stringify({ limit }),
        },
      )
      const claimed = Number(res.worker?.claimed ?? 0)
      toast.success(claimed > 0 ? `Worker ran ${claimed} job(s).` : "Worker ran: no eligible jobs claimed.")
      await refreshAll()
      setNowIso(new Date().toISOString())
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to run worker"
      toast.error(message)
      setError(message)
    } finally {
      setWorkerLoading(false)
    }
  }

  const loadMore = async (tab: "backlog" | "completed") => {
    const cursor = tab === "backlog" ? backlogCursor : completedCursor
    if (!cursor) return
    setLoading(true)
    setError(null)
    try {
      if (tab === "backlog") {
        const effectiveStaleOnly = staleOnly && backlogStatuses.size === 1 && backlogStatuses.has("RUNNING")
        const url = buildJobsUrl({
          order: "RUN_AT_ASC",
          statuses: backlogStatuses,
          types,
          q: qDebounced,
          staleOnly: effectiveStaleOnly,
          cursor,
          limit: 50,
        })
        const page = await fetchJson<JobListResponse>(url)
        setBacklogJobs((prev) => [...prev, ...page.jobs])
        setBacklogCursor(page.nextCursor)
      } else {
        const url = buildJobsUrl({
          order: "COMPLETED_AT_DESC",
          statuses: completedStatuses,
          types,
          q: qDebounced,
          cursor,
          limit: 50,
        })
        const page = await fetchJson<JobListResponse>(url)
        setCompletedJobs((prev) => [...prev, ...page.jobs])
        setCompletedCursor(page.nextCursor)
      }
      setNowIso(new Date().toISOString())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load more")
    } finally {
      setLoading(false)
    }
  }

  const runAction = async (jobId: string, action: { action: string; runAtIso?: string }) => {
    setLoading(true)
    setError(null)
    try {
      await fetchJson(`/api/jobs/${jobId}/actions`, {
        method: "POST",
        headers: withIdempotencyHeader({ "content-type": "application/json" }),
        body: JSON.stringify(action),
      })
      await refreshAll()
      setNowIso(new Date().toISOString())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Action failed")
    } finally {
      setLoading(false)
    }
  }

  const bulkForceUnlockStale = async (jobIds: string[]) => {
    if (!jobIds.length) return
    setLoading(true)
    setError(null)
    try {
      await fetchJson(`/api/jobs/actions`, {
        method: "POST",
        headers: withIdempotencyHeader({ "content-type": "application/json" }),
        body: JSON.stringify({ action: "FORCE_UNLOCK_STALE", jobIds: jobIds.slice(0, 50) }),
      })
      await refreshAll()
      setNowIso(new Date().toISOString())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Bulk force unlock failed")
    } finally {
      setLoading(false)
    }
  }

  const enqueue = async (body: unknown) => {
    setEnqueueLoading(true)
    setError(null)
    try {
      await fetchJson("/api/jobs", {
        method: "POST",
        headers: withIdempotencyHeader({ "content-type": "application/json" }),
        body: JSON.stringify(body),
      })
      await refreshAll()
      setActiveTab("backlog")
      setNowIso(new Date().toISOString())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Enqueue failed")
    } finally {
      setEnqueueLoading(false)
    }
  }

  const viewDetails = (jobId: string) => {
    setDetailJobId(jobId)
    setDetailOpen(true)
  }

  const nowMs = React.useMemo(() => {
    const d = new Date(nowIso)
    return Number.isFinite(d.getTime()) ? d.getTime() : Date.now()
  }, [nowIso])

  const visibleStaleRunning = React.useMemo(() => {
    const staleMs = 15 * 60_000
    return backlogJobs
      .filter((j) => j.status === "RUNNING" && j.lockedAtIso)
      .filter((j) => {
        const lockedAt = new Date(j.lockedAtIso as string)
        if (!Number.isFinite(lockedAt.getTime())) return false
        return nowMs - lockedAt.getTime() >= staleMs
      })
  }, [backlogJobs, nowMs])

  const staleModeActive = staleOnly && backlogStatuses.size === 1 && backlogStatuses.has("RUNNING")

  return (
    <div className="h-full w-full overflow-auto">
      <div className="mx-auto w-full max-w-6xl p-4 lg:p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-lg font-bold">System Health</div>
            <div className="text-xs text-muted-foreground">
              Backlog, completed history, and owner-only job controls.
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isOwner ? (
              <Button
                type="button"
                variant="secondary"
              className="rounded-lg"
              onClick={() => void runWorkerNow(1)}
              disabled={workerLoading || loading || enqueueLoading || props.workerDisabled}
              title={props.workerDisabled ? "Worker execution is disabled (DISABLE_CRON=true)." : "Claims and runs up to 1 eligible job."}
            >
                <ArrowRight className="size-4" />
                <span className="ml-2">Run worker</span>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              className="rounded-lg"
              onClick={applyStuckPreset}
              disabled={loading || enqueueLoading || workerLoading}
            >
              <Zap className="size-4" />
              <span className="ml-2">Stuck</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="rounded-lg"
              onClick={() => void refreshAll()}
              disabled={loading || enqueueLoading || workerLoading}
            >
              <RefreshCw className={cn("size-4", (loading || enqueueLoading) && "animate-spin")} />
              <span className="ml-2">Refresh</span>
            </Button>
          </div>
        </div>

        <Card className="rounded-xl p-4 shadow-card">
          <div className="flex flex-col gap-1">
            <div className="text-xs font-semibold">How Jobs Run</div>
            <div className="text-[11px] text-muted-foreground">
              Jobs execute only when the worker runs. In production this is typically driven by Vercel Cron calling
              <span className="font-mono"> /api/cron/worker</span>. In local development, cron will not run automatically,
              so use <span className="font-semibold">Run worker</span> to drain the queue.
            </div>
            {props.workerDisabled ? (
              <div className="mt-1 text-[11px] text-destructive">
                Worker is disabled for this deployment (<span className="font-mono">DISABLE_CRON=true</span>).
              </div>
            ) : null}
          </div>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Backlog" value={summary.backlog} tone={summary.backlog > 0 ? "warn" : "ok"} />
          <MetricCard label="Running" value={summary.running} tone={summary.running > 0 ? "info" : "ok"} />
          <MetricCard label="Failed (24h)" value={summary.failed24h} tone={summary.failed24h > 0 ? "bad" : "ok"} />
          <Card className="rounded-xl p-4 shadow-card">
            <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Role</div>
            <div className="mt-1.5 text-2xl font-bold tabular-nums">
              <Badge variant="secondary" className="rounded-md">{props.role || "—"}</Badge>
            </div>
          </Card>
        </div>

        <EnqueuePanel
          isOwner={isOwner}
          enabledLocations={props.enabledLocations}
          loading={enqueueLoading || loading}
          onSyncLocations={() => void enqueue({ type: "SYNC_LOCATIONS" })}
          onSyncReviewsAll={() => void enqueue({ type: "SYNC_REVIEWS", mode: "ALL_ENABLED" })}
          onSyncReviewsOne={(locationId) => void enqueue({ type: "SYNC_REVIEWS", mode: "ONE_LOCATION", locationId })}
        />

        {error ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "backlog" | "completed")}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="rounded-xl">
              <TabsTrigger value="backlog" className="rounded-lg">Backlog</TabsTrigger>
              <TabsTrigger value="completed" className="rounded-lg">Completed</TabsTrigger>
            </TabsList>

            <JobFilters
              q={q}
              onQChange={setQ}
              statusOptions={activeTab === "backlog" ? STATUS_OPTIONS_BACKLOG : STATUS_OPTIONS_COMPLETED}
              selectedStatuses={activeTab === "backlog" ? backlogStatuses : completedStatuses}
              onToggleStatus={(value) => toggleSet(activeTab === "backlog" ? setBacklogStatuses : setCompletedStatuses, value)}
              typeOptions={TYPE_OPTIONS}
              selectedTypes={types}
              onToggleType={(value) => toggleSet(setTypes, value)}
              onReset={resetFilters}
            />
          </div>

          <TabsContent value="backlog" className="mt-3">
            {staleModeActive ? (
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-muted-foreground">
                  Showing stale RUNNING jobs (locked &gt; 15m). Server-side filtered.
                </div>
                {isOwner ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="rounded-lg"
                    onClick={() => {
                      const ids = visibleStaleRunning.map((j) => j.id)
                      if (!ids.length) return
                      const ok = window.confirm(`Force unlock ${Math.min(ids.length, 50)} stale jobs?`)
                      if (!ok) return
                      void bulkForceUnlockStale(ids)
                    }}
                    disabled={loading || enqueueLoading || visibleStaleRunning.length === 0}
                  >
                    Force unlock stale ({Math.min(visibleStaleRunning.length, 50)})
                  </Button>
                ) : null}
              </div>
            ) : null}
            <JobTable
              kind="backlog"
              jobs={backlogJobs}
              isOwner={isOwner}
              loading={loading || enqueueLoading}
              nowIso={nowIso}
              onViewDetails={viewDetails}
              onAction={runAction}
            />
            <LoadMore
              show={Boolean(backlogCursor)}
              onClick={() => void loadMore("backlog")}
              disabled={loading || enqueueLoading}
            />
          </TabsContent>

          <TabsContent value="completed" className="mt-3">
            <JobTable
              kind="completed"
              jobs={completedJobs}
              isOwner={isOwner}
              loading={loading || enqueueLoading}
              nowIso={nowIso}
              onViewDetails={viewDetails}
              onAction={runAction}
            />
            <LoadMore
              show={Boolean(completedCursor)}
              onClick={() => void loadMore("completed")}
              disabled={loading || enqueueLoading}
            />
          </TabsContent>
        </Tabs>

        <JobDetailSheet open={detailOpen} jobId={detailJobId} onOpenChange={(o) => setDetailOpen(o)} />
      </div>
    </div>
  )
}

function MetricCard(props: { label: string; value: number; tone: "ok" | "info" | "warn" | "bad" }) {
  const cls =
    props.tone === "bad"
      ? "text-destructive"
      : props.tone === "warn"
        ? "text-primary"
        : "text-foreground"
  return (
    <Card className="rounded-xl p-4 shadow-card">
      <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{props.label}</div>
      <div className={cn("mt-1.5 text-2xl font-bold tabular-nums", cls)}>{props.value}</div>
    </Card>
  )
}

function LoadMore(props: { show: boolean; onClick: () => void; disabled: boolean }) {
  if (!props.show) return null
  return (
    <div className="mt-3 flex justify-center">
      <Button type="button" variant="secondary" className="rounded-lg" onClick={props.onClick} disabled={props.disabled}>
        Load more
      </Button>
    </div>
  )
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = React.useState<T>(value)
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), Math.max(0, delayMs))
    return () => clearTimeout(t)
  }, [value, delayMs])
  return debounced
}
