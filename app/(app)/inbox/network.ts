import { withIdempotencyHeader } from "@/lib/api/client-idempotency"
import { extractClientErrorMessage } from "@/lib/api/client-error"

import type { ReviewDetail } from "@/lib/hooks"

const JOB_POLL_BASE_MS = 900
const JOB_POLL_MAX_MS = 2600
const JOB_SSE_MIN_BUDGET_MS = 900
const JOB_SSE_MAX_BUDGET_MS = 12_000
const JOB_SSE_CLOSE_GRACE_MS = 1_250
const JOB_TERMINAL_CACHE_TTL_MS = 15_000
const JOB_TERMINAL_CACHE_MAX_ENTRIES = 512
const REVIEW_POLL_INTERVAL_MS = 650

type JobStatus = "PENDING" | "RUNNING" | "RETRYING" | "COMPLETED" | "FAILED" | "CANCELLED"

type JobDetail = {
  id: string
  type: string
  status: JobStatus
  attempts: number
  maxAttempts: number
  runAtIso: string
  lockedAtIso: string | null
  completedAtIso: string | null
  lastError: string | null
  retryAfterSec?: number | null
}

type JobStatusResponse = {
  job: JobDetail
}

type JobStreamEvent = {
  kind: "snapshot" | "transition" | "terminal"
  job: JobDetail
  review?: ReviewDetail | null
}

type JobStreamTimeoutEvent = {
  kind: "timeout"
  job: JobDetail | null
}

type TerminalJobCacheEntry = {
  job: JobDetail
  expiresAt: number
}

export type JobCompletionResult = {
  job: JobDetail
  review: ReviewDetail | null
}

const terminalJobCache = new Map<string, TerminalJobCacheEntry>()
const inflightJobDetailRequests = new Map<string, Promise<JobDetail | null>>()
const JOB_STATUS_VALUES = new Set<JobStatus>(["PENDING", "RUNNING", "RETRYING", "COMPLETED", "FAILED", "CANCELLED"])

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isTerminalJobStatus(status: JobStatus) {
  return status === "COMPLETED" || status === "FAILED" || status === "CANCELLED"
}

function trimExpiredTerminalCache(now: number) {
  for (const [key, value] of terminalJobCache.entries()) {
    if (value.expiresAt <= now) {
      terminalJobCache.delete(key)
    }
  }
}

function getCachedTerminalJob(jobId: string): JobDetail | null {
  const now = Date.now()
  const cached = terminalJobCache.get(jobId)
  if (!cached) return null
  if (cached.expiresAt <= now) {
    terminalJobCache.delete(jobId)
    return null
  }
  return cached.job
}

function cacheTerminalJob(job: JobDetail) {
  if (!isTerminalJobStatus(job.status)) return

  const now = Date.now()
  trimExpiredTerminalCache(now)
  terminalJobCache.set(job.id, { job, expiresAt: now + JOB_TERMINAL_CACHE_TTL_MS })
  while (terminalJobCache.size > JOB_TERMINAL_CACHE_MAX_ENTRIES) {
    const oldest = terminalJobCache.keys().next()
    if (oldest.done) break
    terminalJobCache.delete(oldest.value)
  }
}

function resolveJobPollDelayMs(params: {
  job: JobDetail | null
  attempts: number
  remainingMs: number
}) {
  const { job, attempts, remainingMs } = params
  if (remainingMs <= 0) return 0

  const retryAfterMs = Number(job?.retryAfterSec ?? 0) * 1000
  if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
    return Math.min(remainingMs, Math.max(JOB_POLL_BASE_MS, Math.min(4_000, retryAfterMs)))
  }

  const status = job?.status
  const computedDelay =
    status === "PENDING"
      ? JOB_POLL_BASE_MS + attempts * 260
      : status === "RUNNING"
        ? JOB_POLL_BASE_MS + attempts * 210
        : status === "RETRYING"
          ? JOB_POLL_BASE_MS + 450 + attempts * 320
          : JOB_POLL_BASE_MS + attempts * 240

  return Math.min(remainingMs, Math.max(JOB_POLL_BASE_MS, Math.min(JOB_POLL_MAX_MS, computedDelay)))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function parseJobDetail(value: unknown): JobDetail | null {
  if (!isRecord(value)) return null
  const status = value.status
  if (
    typeof value.id !== "string" ||
    typeof value.type !== "string" ||
    typeof status !== "string" ||
    !JOB_STATUS_VALUES.has(status as JobStatus)
  ) {
    return null
  }
  return value as JobDetail
}

function parseJobStreamEvent(data: string): JobStreamEvent | JobStreamTimeoutEvent | null {
  try {
    const raw = JSON.parse(data) as unknown
    if (!isRecord(raw) || typeof raw.kind !== "string") return null

    if (raw.kind === "timeout") {
      const job = parseJobDetail(raw.job)
      return { kind: "timeout", job }
    }

    if (raw.kind !== "snapshot" && raw.kind !== "transition" && raw.kind !== "terminal") {
      return null
    }

    const job = parseJobDetail(raw.job)
    if (!job) return null
    const review = raw.review as ReviewDetail | null | undefined
    return { kind: raw.kind, job, review }
  } catch {
    return null
  }
}

function resolveSseBudgetMs(timeoutMs: number) {
  if (timeoutMs <= 0) return 0
  if (timeoutMs <= JOB_SSE_MIN_BUDGET_MS) return timeoutMs

  const proportional = Math.floor(timeoutMs * 0.6)
  return Math.min(timeoutMs, Math.max(JOB_SSE_MIN_BUDGET_MS, Math.min(JOB_SSE_MAX_BUDGET_MS, proportional)))
}

export async function apiCall<T>(url: string, method: string, body?: unknown): Promise<T> {
  const upper = method.toUpperCase()
  const mutating = ["POST", "PUT", "PATCH", "DELETE"].includes(upper)
  const baseHeaders = body ? { "content-type": "application/json" } : undefined
  const headers = mutating ? withIdempotencyHeader(baseHeaders) : baseHeaders

  const response = await fetch(url, {
    method: upper,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(
      extractClientErrorMessage({
        body: data,
        statusText: response.statusText,
      }),
    )
  }

  return data as T
}

export async function fetchReviewDetail(reviewId: string): Promise<ReviewDetail | null> {
  const response = await fetch(`/api/reviews/${reviewId}`)
  if (!response.ok) return null
  return (await response.json().catch(() => null)) as ReviewDetail | null
}

export async function fetchJobDetail(jobId: string): Promise<JobDetail | null> {
  const cached = getCachedTerminalJob(jobId)
  if (cached) return cached

  const inflight = inflightJobDetailRequests.get(jobId)
  if (inflight) {
    return inflight
  }

  const request = (async () => {
    const response = await fetch(`/api/jobs/${jobId}`)
    if (!response.ok) return null
    const data = (await response.json().catch(() => null)) as JobStatusResponse | null
    const job = data?.job ?? null
    if (job) {
      cacheTerminalJob(job)
    }
    return job
  })()

  inflightJobDetailRequests.set(jobId, request)
  try {
    return await request
  } finally {
    if (inflightJobDetailRequests.get(jobId) === request) {
      inflightJobDetailRequests.delete(jobId)
    }
  }
}

async function waitForJobCompletionViaSse(jobId: string, timeoutMs: number): Promise<JobCompletionResult | null> {
  if (timeoutMs <= 0) return null
  if (typeof window === "undefined" || typeof EventSource === "undefined") return null

  const streamUrl = `/api/jobs/${encodeURIComponent(jobId)}/events?timeoutMs=${Math.floor(timeoutMs)}`

  return new Promise<JobCompletionResult | null>((resolve) => {
    const source = new EventSource(streamUrl)
    let settled = false
    let guardTimer: ReturnType<typeof globalThis.setTimeout> | null = null

    const finish = (value: JobCompletionResult | null) => {
      if (settled) return
      settled = true
      if (guardTimer != null) {
        globalThis.clearTimeout(guardTimer)
      }
      source.close()
      resolve(value)
    }

    const handleMessage = (data: string) => {
      const parsed = parseJobStreamEvent(data)
      if (!parsed) return

      if (parsed.kind === "timeout") {
        finish(null)
        return
      }

      if (!isTerminalJobStatus(parsed.job.status)) {
        return
      }

      cacheTerminalJob(parsed.job)
      finish({
        job: parsed.job,
        review: parsed.review ?? null,
      })
    }

    const onJob = (event: Event) => {
      const message = event as MessageEvent<string>
      handleMessage(message.data)
    }

    const onTimeout = (event: Event) => {
      const message = event as MessageEvent<string>
      const parsed = parseJobStreamEvent(message.data)
      if (parsed?.kind === "timeout") {
        if (parsed.job) {
          cacheTerminalJob(parsed.job)
        }
        finish(null)
        return
      }
      finish(null)
    }

    source.onmessage = onJob as (event: MessageEvent<string>) => void
    source.addEventListener("job", onJob)
    source.addEventListener("timeout", onTimeout)
    source.onerror = () => {
      finish(null)
    }

    guardTimer = globalThis.setTimeout(() => {
      finish(null)
    }, timeoutMs + JOB_SSE_CLOSE_GRACE_MS)
  })
}

async function waitForJobCompletionByPolling(jobId: string, timeoutMs: number): Promise<JobCompletionResult | null> {
  if (timeoutMs <= 0) return null

  const cached = getCachedTerminalJob(jobId)
  if (cached) {
    return { job: cached, review: null }
  }

  const startedAt = Date.now()
  let attempts = 0

  while (Date.now() - startedAt < timeoutMs) {
    const job = await fetchJobDetail(jobId)
    if (job && (job.status === "COMPLETED" || job.status === "FAILED" || job.status === "CANCELLED")) {
      return { job, review: null }
    }

    const elapsedMs = Date.now() - startedAt
    const remainingMs = timeoutMs - elapsedMs
    const delayMs = resolveJobPollDelayMs({ job, attempts, remainingMs })
    if (delayMs <= 0) break
    await sleep(delayMs)
    attempts += 1
  }

  return null
}

export async function waitForJobCompletion(jobId: string, timeoutMs: number): Promise<JobCompletionResult | null> {
  if (timeoutMs <= 0) return null

  const cached = getCachedTerminalJob(jobId)
  if (cached) {
    return { job: cached, review: null }
  }

  const startedAt = Date.now()
  const sseBudgetMs = resolveSseBudgetMs(timeoutMs)
  if (sseBudgetMs > 0) {
    const streamed = await waitForJobCompletionViaSse(jobId, sseBudgetMs)
    if (streamed) {
      return streamed
    }
  }

  const elapsedMs = Date.now() - startedAt
  const remainingMs = timeoutMs - elapsedMs
  if (remainingMs <= 0) return null

  return waitForJobCompletionByPolling(jobId, remainingMs)
}

export async function waitForReviewState(
  reviewId: string,
  predicate: (detail: ReviewDetail) => boolean,
  timeoutMs: number,
) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const detail = await fetchReviewDetail(reviewId)
    if (detail && predicate(detail)) {
      return detail
    }
    await sleep(REVIEW_POLL_INTERVAL_MS)
  }

  return null
}
