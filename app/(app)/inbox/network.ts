import { withIdempotencyHeader } from "@/lib/api/client-idempotency"

import type { ReviewDetail } from "@/lib/hooks"

const JOB_POLL_BASE_MS = 900
const JOB_POLL_MAX_MS = 2600
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

type TerminalJobCacheEntry = {
  job: JobDetail
  expiresAt: number
}

const terminalJobCache = new Map<string, TerminalJobCacheEntry>()
const inflightJobDetailRequests = new Map<string, Promise<JobDetail | null>>()

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
    throw new Error(data?.error ?? response.statusText)
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

export async function waitForJobCompletion(jobId: string, timeoutMs: number): Promise<JobDetail | null> {
  const cached = getCachedTerminalJob(jobId)
  if (cached) return cached

  const startedAt = Date.now()
  let attempts = 0

  while (Date.now() - startedAt < timeoutMs) {
    const job = await fetchJobDetail(jobId)
    if (job && (job.status === "COMPLETED" || job.status === "FAILED" || job.status === "CANCELLED")) {
      return job
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
