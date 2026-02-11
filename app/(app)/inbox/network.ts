import { withIdempotencyHeader } from "@/lib/api/client-idempotency"

import type { ReviewDetail } from "@/lib/hooks"

const POLL_INTERVAL_MS = 450

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
    await sleep(POLL_INTERVAL_MS)
  }

  return null
}
