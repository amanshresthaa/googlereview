"use client"

import * as React from "react"

type UseSmoothLoadingOptions = {
  delayMs?: number
  minDurationMs?: number
}

/**
 * Returns a debounced loading signal that avoids flicker by waiting `delayMs`
 * before showing, then holding for at least `minDurationMs` once visible.
 */
export function useSmoothLoading(active: boolean, options?: UseSmoothLoadingOptions) {
  const delayMs = Math.max(0, options?.delayMs ?? 150)
  const minDurationMs = Math.max(0, options?.minDurationMs ?? 450)

  const [visible, setVisible] = React.useState(active)
  const visibleSinceRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    let delayTimer: ReturnType<typeof setTimeout> | null = null
    let hideTimer: ReturnType<typeof setTimeout> | null = null

    const clearAll = () => {
      if (delayTimer) clearTimeout(delayTimer)
      if (hideTimer) clearTimeout(hideTimer)
    }

    if (active) {
      if (visible && visibleSinceRef.current == null) {
        visibleSinceRef.current = Date.now()
      }
      // Already visible: just keep it.
      if (visible) return () => clearAll()

      delayTimer = setTimeout(() => {
        visibleSinceRef.current = Date.now()
        setVisible(true)
      }, delayMs)
      return () => clearAll()
    }

    // Not active: if never shown, hide immediately.
    if (!visible) return () => clearAll()

    const since = visibleSinceRef.current
    const elapsed = since ? Date.now() - since : minDurationMs
    const remaining = Math.max(0, minDurationMs - elapsed)

    hideTimer = setTimeout(() => {
      visibleSinceRef.current = null
      setVisible(false)
    }, remaining)

    return () => clearAll()
  }, [active, delayMs, minDurationMs, visible])

  return visible
}
