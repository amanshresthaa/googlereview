"use client"

import * as React from "react"

import type { ReviewDetail } from "./types"

type UseReviewDetailResult = {
  review: ReviewDetail | null
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useReviewDetail(reviewId: string | null): UseReviewDetailResult {
  const [review, setReview] = React.useState<ReviewDetail | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const abortRef = React.useRef<AbortController | null>(null)

  const fetchReview = React.useCallback(async (id: string) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/reviews/${id}`, {
        signal: controller.signal,
      })

      if (controller.signal.aborted) return

      if (res.status === 401) {
        setError("SESSION_EXPIRED")
        return
      }

      if (res.status === 404) {
        setError("Review not found or not accessible")
        return
      }

      if (!res.ok) {
        let msg = res.statusText
        try {
          const body = await res.json()
          msg = body.error || msg
        } catch {
          // use statusText
        }
        setError(msg)
        return
      }

      const data = await res.json()
      setReview(data)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, [])

  React.useEffect(() => {
    if (!reviewId) {
      setReview(null)
      setLoading(false)
      setError(null)
      return
    }

    void fetchReview(reviewId)

    return () => {
      abortRef.current?.abort()
    }
  }, [reviewId, fetchReview])

  const refresh = React.useCallback(() => {
    if (reviewId) {
      void fetchReview(reviewId)
    }
  }, [reviewId, fetchReview])

  return { review, loading, error, refresh }
}
