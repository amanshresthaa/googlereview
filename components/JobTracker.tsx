"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  X,
} from "@/components/icons"

type JobStatus = "PENDING" | "RUNNING" | "RETRYING" | "COMPLETED" | "FAILED" | "CANCELLED"

type JobDetail = {
  id: string
  type: string
  status: JobStatus
  attempts: number
  maxAttempts: number
  lastError: string | null
  retryAfterSec?: number | null
}

type JobTrackerProps = {
  jobId: string
  onComplete?: (success: boolean) => void
  onError?: (error: string) => void
  showProgress?: boolean
  inline?: boolean
  autoClose?: boolean
  autoCloseDelay?: number
}

type StreamEvent =
  | {
      kind: "snapshot" | "transition" | "terminal"
      job: JobDetail
    }
  | {
      kind: "timeout"
      job: JobDetail | null
    }

const TERMINAL_STATES = new Set<JobStatus>(["COMPLETED", "FAILED", "CANCELLED"])

function parseStreamEvent(raw: string): StreamEvent | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") return null
    const payload = parsed as Record<string, unknown>
    if (payload.kind === "timeout") {
      const job = payload.job as JobDetail | null
      return { kind: "timeout", job: job ?? null }
    }
    if (payload.kind === "snapshot" || payload.kind === "transition" || payload.kind === "terminal") {
      return {
        kind: payload.kind,
        job: payload.job as JobDetail,
      }
    }
    return null
  } catch {
    return null
  }
}

function progressFromStatus(status: JobStatus) {
  if (status === "PENDING") return 20
  if (status === "RUNNING") return 55
  if (status === "RETRYING") return 75
  if (status === "COMPLETED") return 100
  return 100
}

function progressVariant(status: JobStatus): "default" | "success" | "warning" | "error" {
  if (status === "COMPLETED") return "success"
  if (status === "RETRYING") return "warning"
  if (status === "FAILED" || status === "CANCELLED") return "error"
  return "default"
}

function statusText(status: JobStatus) {
  if (status === "PENDING") return "Queued"
  if (status === "RUNNING") return "Processing"
  if (status === "RETRYING") return "Retrying"
  if (status === "COMPLETED") return "Completed"
  if (status === "FAILED") return "Failed"
  return "Cancelled"
}

function formatJobType(type: string) {
  return type
    .split("_")
    .map((value) => value.slice(0, 1) + value.slice(1).toLowerCase())
    .join(" ")
}

function StatusIcon({ status, className }: { status: JobStatus; className?: string }) {
  if (status === "COMPLETED") return <CheckCircle2 className={cn("text-success", className)} />
  if (status === "FAILED" || status === "CANCELLED") return <X className={cn("text-destructive", className)} />
  if (status === "RETRYING") return <AlertTriangle className={cn("text-warning", className)} />
  if (status === "RUNNING") {
    return (
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
        <RefreshCw className={cn("text-primary", className)} />
      </motion.div>
    )
  }
  return <Clock className={cn("text-muted-foreground", className)} />
}

export function JobTracker({
  jobId,
  onComplete,
  onError,
  showProgress = true,
  inline = false,
  autoClose = true,
  autoCloseDelay = 2400,
}: JobTrackerProps) {
  const [job, setJob] = React.useState<JobDetail | null>(null)
  const [visible, setVisible] = React.useState(true)

  React.useEffect(() => {
    if (!jobId) return

    let mounted = true
    const source = new EventSource(`/api/jobs/${encodeURIComponent(jobId)}/events?timeoutMs=25000`)

    const handleTerminal = (next: JobDetail) => {
      const isSuccess = next.status === "COMPLETED"
      if (isSuccess) {
        onComplete?.(true)
        if (autoClose) {
          window.setTimeout(() => {
            if (mounted) setVisible(false)
          }, autoCloseDelay)
        }
      } else {
        const errorMessage = next.lastError || "Job failed"
        onError?.(errorMessage)
        onComplete?.(false)
      }
    }

    const onJobEvent = (event: Event) => {
      const message = event as MessageEvent<string>
      const parsed = parseStreamEvent(message.data)
      if (!parsed || parsed.kind === "timeout") return
      if (!mounted) return
      setJob(parsed.job)
      if (TERMINAL_STATES.has(parsed.job.status)) {
        handleTerminal(parsed.job)
      }
    }

    const onTimeoutEvent = (event: Event) => {
      const message = event as MessageEvent<string>
      const parsed = parseStreamEvent(message.data)
      if (!mounted) return
      if (parsed?.kind === "timeout" && parsed.job) {
        setJob(parsed.job)
      }
      void pollJobUntilTerminal({
        jobId,
        setJob: (next) => mounted && setJob(next),
        onComplete,
        onError,
      })
    }

    source.addEventListener("job", onJobEvent)
    source.addEventListener("timeout", onTimeoutEvent)
    source.onerror = () => {
      source.close()
      void pollJobUntilTerminal({
        jobId,
        setJob: (next) => mounted && setJob(next),
        onComplete,
        onError,
      })
    }

    return () => {
      mounted = false
      source.close()
    }
  }, [autoClose, autoCloseDelay, jobId, onComplete, onError])

  if (!visible) return null

  const status = job?.status ?? "PENDING"
  if (inline) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <StatusIcon status={status} className="h-3.5 w-3.5" />
        {statusText(status)}
      </span>
    )
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="app-pane-card rounded-xl border-shell-foreground/10 bg-shell-foreground/10 p-3"
      >
        <div className="flex items-start gap-2.5">
          <StatusIcon status={status} className="mt-0.5 h-4 w-4" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-black tracking-tight text-foreground">{statusText(status)}</p>
              <Badge variant="outline" className="rounded-md border-shell-foreground/10 bg-muted/30 px-1.5 text-[10px] font-black uppercase">
                {status}
              </Badge>
            </div>
            {job?.type ? <p className="mt-0.5 text-xs text-muted-foreground">{formatJobType(job.type)}</p> : null}
            {showProgress ? (
              <div className="mt-2">
                <Progress value={progressFromStatus(status)} variant={progressVariant(status)} />
              </div>
            ) : null}
            {job?.lastError && (status === "FAILED" || status === "CANCELLED") ? (
              <p className="mt-2 text-xs text-destructive">{job.lastError}</p>
            ) : null}
            {job && job.attempts > 1 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Attempt {job.attempts} of {job.maxAttempts}
              </p>
            ) : null}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

async function pollJobUntilTerminal(input: {
  jobId: string
  setJob: (job: JobDetail) => void
  onComplete?: (success: boolean) => void
  onError?: (error: string) => void
}) {
  const { jobId, setJob, onComplete, onError } = input
  let attempt = 0
  const maxAttempts = 18

  while (attempt < maxAttempts) {
    const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`)
    if (!response.ok) return
    const payload = (await response.json().catch(() => null)) as { job?: JobDetail } | null
    const job = payload?.job
    if (!job) return

    setJob(job)
    if (TERMINAL_STATES.has(job.status)) {
      if (job.status === "COMPLETED") {
        onComplete?.(true)
      } else {
        const errorMessage = job.lastError || "Job failed"
        onError?.(errorMessage)
        onComplete?.(false)
      }
      return
    }

    const delayMs = Math.max(900, Math.min(3200, Number(job.retryAfterSec ?? 0) * 1000 || 1400))
    await new Promise((resolve) => setTimeout(resolve, delayMs))
    attempt += 1
  }
}
