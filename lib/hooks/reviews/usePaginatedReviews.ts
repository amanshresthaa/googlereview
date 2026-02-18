"use client"

import * as React from "react"

import { REVIEWS_PAGE_SIZE } from "@/lib/reviews/constants"
import { emitUnansweredCount } from "@/lib/reviews/count-events"
import type { ReviewListPage } from "@/lib/reviews/types"

import type { ReviewCounts, ReviewFilter, ReviewRow, ReviewStatusFilter } from "./types"

export type ReviewInitialPage = ReviewListPage & {
  filter: ReviewFilter
  status?: ReviewStatusFilter
  mention?: string | null
}

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

function initialPageMatchesFilters(input: {
  initialPage: ReviewInitialPage | null | undefined
  filter: ReviewFilter
  mention?: string
  status: ReviewStatusFilter
  locationId?: string
  rating?: number
  search?: string
}) {
  const { initialPage, filter, mention, status, locationId, rating, search } = input
  return (
    !!initialPage &&
    !locationId &&
    rating == null &&
    !search &&
    initialPage.filter === filter &&
    (initialPage.mention ?? null) === (mention ?? null) &&
    (initialPage.status == null || initialPage.status === status)
  )
}

export function usePaginatedReviews(opts: {
  filter: ReviewFilter
  mention?: string
  status?: ReviewStatusFilter
  locationId?: string
  rating?: number
  search?: string
  enabled?: boolean
  initialPage?: ReviewInitialPage | null
}): UsePaginatedReviewsResult {
  const { filter, mention, status = "all", locationId, rating, search, enabled = true, initialPage } = opts
  const initialMatches = initialPageMatchesFilters({
    initialPage,
    filter,
    mention,
    status,
    locationId,
    rating,
    search,
  })
  const seededInitialPage = initialMatches ? initialPage : null
  const initialConsumedRef = React.useRef(false)

  const [rows, setRows] = React.useState<ReviewRow[]>(seededInitialPage?.rows ?? [])
  const [counts, setCounts] = React.useState<ReviewCounts | null>(seededInitialPage?.counts ?? null)
  const [loading, setLoading] = React.useState(enabled && !initialMatches)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [hasMore, setHasMore] = React.useState(Boolean(seededInitialPage?.nextCursor))

  const cursorRef = React.useRef<string | null>(seededInitialPage?.nextCursor ?? null)
  const abortRef = React.useRef<AbortController | null>(null)
  const countsAbortRef = React.useRef<AbortController | null>(null)
  const countsLoadingRef = React.useRef(false)
  const hasLoadedCountsRef = React.useRef(initialMatches && seededInitialPage?.counts !== undefined)

  const setCountsWithBroadcast = React.useCallback((nextCounts: ReviewCounts) => {
    setCounts(nextCounts)
    emitUnansweredCount(nextCounts.unanswered)
  }, [])

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
          setCountsWithBroadcast(data.counts)
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
    [filter, mention, status, locationId, rating, search, setCountsWithBroadcast],
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
        setCountsWithBroadcast(data.counts)
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
  }, [setCountsWithBroadcast])

  React.useEffect(() => {
    cursorRef.current = null
    setHasMore(false)

    const canUseInitialPage =
      !initialConsumedRef.current &&
      initialPageMatchesFilters({
        initialPage,
        filter,
        mention,
        status,
        locationId,
        rating,
        search,
      })

    const matchedInitialPage = canUseInitialPage ? initialPage : null
    if (matchedInitialPage) {
      initialConsumedRef.current = true
      hasLoadedCountsRef.current = matchedInitialPage.counts !== undefined
      setRows(matchedInitialPage.rows)
      if (matchedInitialPage.counts) {
        setCountsWithBroadcast(matchedInitialPage.counts)
      } else {
        setCounts(null)
      }
      cursorRef.current = matchedInitialPage.nextCursor
      setHasMore(Boolean(matchedInitialPage.nextCursor))
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
  }, [enabled, fetchPage, filter, initialPage, locationId, mention, rating, search, setCountsWithBroadcast, status])

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
  }, [enabled, fetchPage, hasMore, loading, loadingMore])

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
