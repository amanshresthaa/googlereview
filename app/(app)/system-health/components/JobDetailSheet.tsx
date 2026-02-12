"use client"

import * as React from "react"
import Link from "next/link"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Loader2, ExternalLink } from "@/components/icons"
import { cn } from "@/lib/utils"

type JobDetail = {
  id: string
  type: string
  status: string
  attempts: number
  maxAttempts: number
  runAtIso: string
  lockedAtIso: string | null
  completedAtIso: string | null
  createdAtIso: string
  dedupKey: string | null
  payload: Record<string, unknown> | null
  lastError: string | null
  lastErrorCode: string | null
  lastErrorMeta: Record<string, unknown> | null
  triggeredByUserId: string | null
  triggeredByRequestId: string | null
  retryAfterSec?: number | null
  dspyLatest?: {
    id: string
    createdAtIso: string
    status: "COMPLETED" | "FAILED"
    mode: "AUTO" | "MANUAL_REGENERATE" | "VERIFY_EXISTING_DRAFT"
    decision: string | null
    errorCode: string | null
    errorMessage: string | null
    programVersion: string | null
    draftModel: string | null
    verifyModel: string | null
    draftTraceId: string | null
    verifyTraceId: string | null
    latencyMs: number | null
  } | null
}

type JobDetailResponse = { job: JobDetail }

function JsonBlock({ value }: { value: unknown }) {
  const text = React.useMemo(() => {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }, [value])

  return (
    <pre className="mt-2 rounded-lg border bg-muted/30 p-3 text-[11px] leading-relaxed overflow-auto max-h-[260px]">
      {text}
    </pre>
  )
}

function shortId(id: string) {
  if (!id) return id
  if (id.length <= 12) return id
  return `${id.slice(0, 6)}…${id.slice(-4)}`
}

export function JobDetailSheet(props: {
  open: boolean
  jobId: string | null
  onOpenChange: (open: boolean) => void
}) {
  const { open, jobId } = props
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [job, setJob] = React.useState<JobDetail | null>(null)

  React.useEffect(() => {
    if (!open || !jobId) return

    let mounted = true
    const controller = new AbortController()

    setLoading(true)
    setError(null)
    setJob(null)

    void (async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}?includeDspyLatest=1`, { signal: controller.signal })
        if (!mounted) return
        if (!res.ok) {
          setError(res.statusText)
          return
        }
        const data = (await res.json().catch(() => null)) as JobDetailResponse | null
        setJob(data?.job ?? null)
      } catch (err: unknown) {
        if (!mounted) return
        if (err instanceof DOMException && err.name === "AbortError") return
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    return () => {
      mounted = false
      controller.abort()
    }
  }, [open, jobId])

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="text-base">Job Details</SheetTitle>
          <SheetDescription className="text-xs">
            Inspect payload and error metadata. Mutations are owner-only.
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading…
          </div>
        ) : error ? (
          <div className="mt-6 text-sm text-destructive">Failed to load job: {error}</div>
        ) : job ? (
          <div className="mt-6 grid gap-3">
            <Card className="rounded-xl p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate">{job.type}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground font-mono truncate">
                    {job.id}
                  </div>
                </div>
                <Badge variant="secondary" className="rounded-md">{job.status}</Badge>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                <div>
                  <div className="font-semibold text-foreground/80">Attempts</div>
                  <div className="tabular-nums">{job.attempts} / {job.maxAttempts}</div>
                </div>
                <div>
                  <div className="font-semibold text-foreground/80">Retry After</div>
                  <div className="tabular-nums">{job.retryAfterSec ?? "—"}</div>
                </div>
                <div className="col-span-2">
                  <div className="font-semibold text-foreground/80">Dedup Key</div>
                  <div className="font-mono break-words">{job.dedupKey ?? "—"}</div>
                </div>
              </div>
            </Card>

            <Card className="rounded-xl p-4 shadow-card">
              <div className="text-xs font-semibold">Timing</div>
              <div className="mt-2 grid gap-2 text-[11px] text-muted-foreground">
                <div className="flex items-center justify-between gap-2">
                  <span>Created</span>
                  <span className="font-mono">{job.createdAtIso}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Run At</span>
                  <span className="font-mono">{job.runAtIso}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Locked At</span>
                  <span className="font-mono">{job.lockedAtIso ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Completed At</span>
                  <span className="font-mono">{job.completedAtIso ?? "—"}</span>
                </div>
              </div>
            </Card>

            <Card className="rounded-xl p-4 shadow-card">
              <div className="text-xs font-semibold">Payload (Allowlisted)</div>
              {job.payload ? <JsonBlock value={job.payload} /> : <div className="mt-2 text-[11px] text-muted-foreground">—</div>}
            </Card>

            {job.type === "PROCESS_REVIEW" ? (
              <Card className="rounded-xl p-4 shadow-card">
                <div className="text-xs font-semibold">DSPy (Latest Run)</div>
                {job.dspyLatest ? (
                  <div className="mt-2 grid gap-2 text-[11px] text-muted-foreground">
                    <div className="flex items-center justify-between gap-2">
                      <span>Status</span>
                      <span className={cn("font-mono", job.dspyLatest.status === "FAILED" && "text-destructive")}>
                        {job.dspyLatest.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Created</span>
                      <span className="font-mono">{job.dspyLatest.createdAtIso}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Mode</span>
                      <span className="font-mono">{job.dspyLatest.mode}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Decision</span>
                      <span className="font-mono">{job.dspyLatest.decision ?? "—"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Latency</span>
                      <span className="font-mono">{job.dspyLatest.latencyMs != null ? `${job.dspyLatest.latencyMs}ms` : "—"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Error Code</span>
                      <span className={cn("font-mono", job.dspyLatest.errorCode && "text-destructive")}>
                        {job.dspyLatest.errorCode ?? "—"}
                      </span>
                    </div>
                    {job.dspyLatest.errorMessage ? (
                      <div className="rounded-lg border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed break-words">
                        {job.dspyLatest.errorMessage}
                      </div>
                    ) : null}
                    {job.dspyLatest.programVersion ? (
                      <div className="flex items-center justify-between gap-2">
                        <span>Program</span>
                        <span className="font-mono">{job.dspyLatest.programVersion}</span>
                      </div>
                    ) : null}
                    {(job.dspyLatest.draftModel || job.dspyLatest.verifyModel) ? (
                      <div className="grid gap-1">
                        <div className="flex items-center justify-between gap-2">
                          <span>Draft Model</span>
                          <span className="font-mono">{job.dspyLatest.draftModel ?? "—"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span>Verify Model</span>
                          <span className="font-mono">{job.dspyLatest.verifyModel ?? "—"}</span>
                        </div>
                      </div>
                    ) : null}
                    {(job.dspyLatest.draftTraceId || job.dspyLatest.verifyTraceId) ? (
                      <div className="grid gap-1">
                        <div className="flex items-center justify-between gap-2">
                          <span>Draft Trace</span>
                          <span className="font-mono">{job.dspyLatest.draftTraceId ?? "—"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span>Verify Trace</span>
                          <span className="font-mono">{job.dspyLatest.verifyTraceId ?? "—"}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    No DSPy run found for this review yet.
                  </div>
                )}
              </Card>
            ) : null}

            <Card className="rounded-xl p-4 shadow-card">
              <div className="text-xs font-semibold">Shortcuts</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {typeof job.payload?.reviewId === "string" ? (
                  <Button asChild variant="secondary" className="rounded-lg">
                    <Link href={`/reviews/${job.payload.reviewId}`}>
                      <ExternalLink className="size-4" />
                      <span className="ml-2">Open Review</span>
                    </Link>
                  </Button>
                ) : null}
                {typeof job.payload?.locationId === "string" ? (
                  <Button asChild variant="secondary" className="rounded-lg">
                    <Link href="/locations">
                      <ExternalLink className="size-4" />
                      <span className="ml-2">Open Locations</span>
                    </Link>
                  </Button>
                ) : null}
                <Button asChild variant="secondary" className="rounded-lg">
                  <Link href="/system-health">
                    <ExternalLink className="size-4" />
                    <span className="ml-2">System Health</span>
                  </Link>
                </Button>
              </div>
              {typeof job.payload?.locationId === "string" ? (
                <div className="mt-2 text-[11px] text-muted-foreground font-mono break-words">
                  locationId: {job.payload.locationId}
                </div>
              ) : null}
            </Card>

            <Card className="rounded-xl p-4 shadow-card">
              <div className="text-xs font-semibold">Last Error</div>
              <div className={cn("mt-2 text-[11px] font-mono break-words", job.lastError ? "text-destructive" : "text-muted-foreground")}>
                {job.lastError ?? "—"}
              </div>
              {job.lastErrorMeta ? <JsonBlock value={job.lastErrorMeta} /> : null}
            </Card>

            <div className="flex items-center justify-end gap-2">
              <div className="text-[11px] text-muted-foreground font-mono" title={job.id}>
                {shortId(job.id)}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 text-sm text-muted-foreground">No job selected.</div>
        )}
      </SheetContent>
    </Sheet>
  )
}
