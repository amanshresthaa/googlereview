"use client"

import * as React from "react"

export type JobSummary = {
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

export function useJobSummaryPolling(pollMs: number = 60_000): UseJobSummaryResult {
  const [summary, setSummary] = React.useState<JobSummary | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let mounted = true
    let visible = typeof document === "undefined" ? true : document.visibilityState === "visible"
    let timer: ReturnType<typeof setTimeout> | null = null
    let controller: AbortController | null = null

    const schedule = (ms: number) => {
      if (!mounted) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        void run()
      }, ms)
    }

    const run = async () => {
      if (!mounted || !visible) return
      controller?.abort()
      controller = new AbortController()

      try {
        const res = await fetch("/api/jobs/summary", { signal: controller.signal })
        if (!mounted) return
        if (!res.ok) {
          setError(res.statusText)
          schedule(pollMs)
          return
        }
        const data = await res.json()
        setSummary(data.summary)
        setError(null)
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return
        if (!mounted) return
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        schedule(pollMs)
      }
    }

    const onVisibilityChange = () => {
      visible = document.visibilityState === "visible"
      if (visible) {
        // Catch up immediately when tab becomes active again.
        schedule(0)
      }
    }

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange)
    }

    // Defer initial fetch to avoid competing with route navigation / hydration.
    type RequestIdleCallback = (cb: () => void, opts?: { timeout?: number }) => number
    const requestIdleCallback = (globalThis as unknown as { requestIdleCallback?: RequestIdleCallback }).requestIdleCallback
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => schedule(0), { timeout: 1200 })
    } else {
      schedule(250)
    }

    return () => {
      mounted = false
      controller?.abort()
      if (timer) clearTimeout(timer)
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange)
      }
    }
  }, [pollMs])

  const backlog = React.useMemo(() => {
    if (!summary) return 0
    return Object.values(summary.byType).reduce(
      (sum, item) => sum + item.pending + item.running + item.retrying,
      0,
    )
  }, [summary])

  const failed24h = React.useMemo(() => {
    if (!summary) return 0
    return Object.values(summary.byType).reduce((sum, item) => sum + item.failed_24h, 0)
  }, [summary])

  return { summary, backlog, failed24h, error }
}
