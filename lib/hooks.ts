"use client"

import * as React from "react"
import type { ReviewListCounts, ReviewListPage, ReviewListRow } from "@/lib/reviews/types"
import { REVIEWS_PAGE_SIZE } from "@/lib/reviews/constants"

export type ReviewFilter = "unanswered" | "urgent" | "five_star" | "mentions" | "all"

export type ReviewRow = ReviewListRow
export type ReviewCounts = ReviewListCounts

type UsePaginatedReviewsResult = {
  rows: ReviewRow[]
  counts: ReviewCounts | null
  loading: boolean
  loadingMore: boolean
  error: string | null
  hasMore: boolean
  loadMore: () => void
  refresh: () => void
  updateRow: (id: string, updater: (row: ReviewRow) => ReviewRow) => void
}

export function usePaginatedReviews(opts: {
  filter: ReviewFilter
  mention?: string
  status?: "pending" | "replied" | "all"
  locationId?: string
  rating?: number
  search?: string
  enabled?: boolean
  initialPage?: (ReviewListPage & {
    filter: ReviewFilter
    status?: "pending" | "replied" | "all"
    mention?: string | null
  }) | null
}): UsePaginatedReviewsResult {
  const { filter, mention, status = "all", locationId, rating, search, enabled = true, initialPage } = opts
  const initialMatches =
    !!initialPage &&
    !locationId &&
    rating == null &&
    !search &&
    initialPage.filter === filter &&
    (initialPage.mention ?? null) === (mention ?? null) &&
    (initialPage.status == null || initialPage.status === status)
  const initialConsumedRef = React.useRef(false)

  const [rows, setRows] = React.useState<ReviewRow[]>(
    initialMatches ? initialPage.rows : []
  )
  const [counts, setCounts] = React.useState<ReviewCounts | null>(
    initialMatches ? initialPage.counts ?? null : null
  )
  const [loading, setLoading] = React.useState(enabled && !initialMatches)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [hasMore, setHasMore] = React.useState(initialMatches ? Boolean(initialPage.nextCursor) : false)
  const cursorRef = React.useRef<string | null>(initialMatches ? initialPage.nextCursor : null)
  const abortRef = React.useRef<AbortController | null>(null)
  const countsAbortRef = React.useRef<AbortController | null>(null)
  const countsLoadingRef = React.useRef(false)
  const hasLoadedCountsRef = React.useRef(initialMatches && initialPage.counts !== undefined)

  const fetchPage = React.useCallback(
    async (cursor: string | null, append: boolean, includeCounts: boolean) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }
      setError(null)

      const params = new URLSearchParams({ filter, limit: String(REVIEWS_PAGE_SIZE) })
      if (mention) params.set("mention", mention)
      params.set("status", status)
      if (locationId) params.set("locationId", locationId)
      if (rating != null) params.set("rating", String(rating))
      if (search) params.set("search", search)
      if (cursor) params.set("cursor", cursor)
      params.set("includeCounts", !cursor && includeCounts ? "1" : "0")

      try {
        const res = await fetch(`/api/reviews?${params.toString()}`, {
          signal: controller.signal,
        })

        if (controller.signal.aborted) return

        if (res.status === 401) {
          setError("SESSION_EXPIRED")
          return
        }

        if (!res.ok) {
          let msg = res.statusText
          try {
            const body = await res.json()
            if (body.error === "BAD_CURSOR") {
              cursorRef.current = null
              fetchPage(null, false, includeCounts)
              return
            }
            msg = body.error || msg
          } catch {
            // use statusText
          }
          setError(msg)
          return
        }

        const data = await res.json()

        if (append) {
          setRows((prev) => [...prev, ...data.rows])
        } else {
          setRows(data.rows)
        }

        if (data.counts !== undefined) {
          setCounts(data.counts)
        }

        if (!append && !cursor && includeCounts) {
          hasLoadedCountsRef.current = true
        }

        cursorRef.current = data.nextCursor ?? null
        setHasMore(!!data.nextCursor)
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [filter, mention, status, locationId, rating, search],
  )

  const fetchCounts = React.useCallback(async () => {
    if (hasLoadedCountsRef.current || countsLoadingRef.current) return

    countsAbortRef.current?.abort()
    const controller = new AbortController()
    countsAbortRef.current = controller
    countsLoadingRef.current = true

    try {
      const res = await fetch("/api/reviews/counts", { signal: controller.signal })
      if (controller.signal.aborted) return

      if (res.status === 401) {
        setError("SESSION_EXPIRED")
        return
      }

      if (!res.ok) {
        return
      }

      const data = await res.json()
      if (data.counts !== undefined) {
        setCounts(data.counts)
        hasLoadedCountsRef.current = true
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return
      // Ignore background count refresh failures to avoid interrupting list UX.
    } finally {
      countsLoadingRef.current = false
      if (countsAbortRef.current === controller) {
        countsAbortRef.current = null
      }
    }
  }, [])

  React.useEffect(() => {
    cursorRef.current = null
    setHasMore(false)

    const canUseInitialPage =
      !!initialPage &&
      !initialConsumedRef.current &&
      !locationId &&
      rating == null &&
      !search &&
      initialPage.filter === filter &&
      (initialPage.mention ?? null) === (mention ?? null) &&
      (initialPage.status == null || initialPage.status === status)

    if (canUseInitialPage) {
      initialConsumedRef.current = true
      hasLoadedCountsRef.current = initialPage.counts !== undefined
      setRows(initialPage.rows)
      setCounts(initialPage.counts ?? null)
      cursorRef.current = initialPage.nextCursor
      setHasMore(Boolean(initialPage.nextCursor))
      setLoading(false)
      setLoadingMore(false)
      setError(null)
      return () => {
        abortRef.current?.abort()
        countsAbortRef.current?.abort()
      }
    }

    if (!enabled) {
      setLoading(false)
      setLoadingMore(false)
      return () => {
        abortRef.current?.abort()
        countsAbortRef.current?.abort()
      }
    }

    fetchPage(null, false, false)

    return () => {
      abortRef.current?.abort()
      countsAbortRef.current?.abort()
    }
  }, [enabled, fetchPage, filter, mention, status, locationId, rating, search, initialPage])

  React.useEffect(() => {
    if (!enabled) return
    if (loading || hasLoadedCountsRef.current) return
    if (typeof window === "undefined") return

    const idleWindow = window as Window & {
      requestIdleCallback?: (cb: () => void, options?: { timeout?: number }) => number
      cancelIdleCallback?: (handle: number) => void
    }

    const run = () => {
      void fetchCounts()
    }

    if (typeof idleWindow.requestIdleCallback === "function") {
      const handle = idleWindow.requestIdleCallback(run, { timeout: 1200 })
      return () => {
        idleWindow.cancelIdleCallback?.(handle)
      }
    }

    const timeout = window.setTimeout(run, 0)
    return () => {
      window.clearTimeout(timeout)
    }
  }, [enabled, loading, fetchCounts])

  const loadMore = React.useCallback(() => {
    if (!enabled || !hasMore || loadingMore || loading) return
    fetchPage(cursorRef.current, true, false)
  }, [enabled, hasMore, loadingMore, loading, fetchPage])

  const refresh = React.useCallback(() => {
    if (!enabled) return
    cursorRef.current = null
    setHasMore(false)
    fetchPage(null, false, true)
  }, [enabled, fetchPage])
  const updateRow = React.useCallback((id: string, updater: (row: ReviewRow) => ReviewRow) => {
    setRows((prev) => prev.map((row) => (row.id === id ? updater(row) : row)))
  }, [])

  return { rows, counts, loading, loadingMore, error, hasMore, loadMore, refresh, updateRow }
}

type JobSummary = {
  byType: Record<
    string,
    { pending: number; running: number; retrying: number; failed_24h: number }
  >
  recentFailures: Array<{
    id: string
    type: string
    completedAtIso: string | null
    lastError: string | null
  }>
  aiQuality24h?: {
    runs: number
    blocked: number
    stuffingRisk: number
    avgKeywordCoverage: number
    blockedRate: number
    stuffingRiskRate: number
    requiredKeywordUsageRate: number
    topProgramVersion: string | null
    programVersions: Array<{
      version: string
      runs: number
      blockedRate: number
      avgKeywordCoverage: number
      requiredKeywordUsageRate: number
    }>
    modeDistribution: Array<{
      mode: "AUTO" | "MANUAL_REGENERATE" | "VERIFY_EXISTING_DRAFT"
      runs: number
      ratio: number
    }>
  }
}

type UseJobSummaryResult = {
  summary: JobSummary | null
  backlog: number
  failed24h: number
  error: string | null
}

export function useJobSummaryPolling(pollMs: number = 20000): UseJobSummaryResult {
  const [summary, setSummary] = React.useState<JobSummary | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let mounted = true

    const fetchSummary = async () => {
      try {
        const res = await fetch("/api/jobs/summary")
        if (!mounted) return
        if (!res.ok) {
          setError(res.statusText)
          return
        }
        const data = await res.json()
        setSummary(data.summary)
        setError(null)
      } catch (err: unknown) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : "Unknown error")
      }
    }

    fetchSummary()
    const interval = setInterval(fetchSummary, pollMs)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [pollMs])

  const backlog = React.useMemo(() => {
    if (!summary) return 0
    return Object.values(summary.byType).reduce(
      (sum, t) => sum + t.pending + t.running + t.retrying,
      0,
    )
  }, [summary])

  const failed24h = React.useMemo(() => {
    if (!summary) return 0
    return Object.values(summary.byType).reduce((sum, t) => sum + t.failed_24h, 0)
  }, [summary])

  return { summary, backlog, failed24h, error }
}

export type ReviewDetail = {
  id: string
  starRating: number
  comment: string | null
  createTime: string
  updateTime: string
  reviewer: { displayName: string | null; isAnonymous: boolean }
  reply: { comment: string | null; updateTime: string | null }
  location: { id: string; name: string }
  mentions: string[]
  currentDraft: {
    id: string
    text: string
    status: string
    version: number
    verifierResultJson: unknown | null
    updatedAt?: string
  } | null
  drafts: Array<{
    id: string
    text: string
    status: string
    version: number
    updatedAt?: string
  }>
}

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

  const fetchReview = React.useCallback(
    async (id: string) => {
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
    },
    [],
  )

  React.useEffect(() => {
    if (!reviewId) {
      setReview(null)
      setLoading(false)
      setError(null)
      return
    }

    fetchReview(reviewId)

    return () => {
      abortRef.current?.abort()
    }
  }, [reviewId, fetchReview])

  const refresh = React.useCallback(() => {
    if (reviewId) {
      fetchReview(reviewId)
    }
  }, [reviewId, fetchReview])

  return { review, loading, error, refresh }
}

export function formatAge(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diffMs = now - then
  const minutes = Math.floor(diffMs / 60000)

  if (minutes < 60) return `${Math.max(minutes, 0)}m`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`

  const weeks = Math.floor(days / 7)
  return `${weeks}w`
}
