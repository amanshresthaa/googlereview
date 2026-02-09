export function computeBackoffMs(attempts: number) {
  const base = 10_000 // 10s
  const max = 15 * 60_000 // 15m
  const expo = Math.min(max, base * Math.pow(2, Math.max(0, attempts)))
  // Add small jitter to avoid thundering herd.
  const jitter = Math.floor(Math.random() * 2_000)
  return Math.min(max, expo + jitter)
}

