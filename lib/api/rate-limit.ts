import { prisma } from "@/lib/db"
import { ApiError } from "@/lib/api/errors"
import type { RateLimitScope } from "@/lib/api/limits"
import { RATE_LIMITS_PER_MINUTE } from "@/lib/api/limits"
import crypto from "node:crypto"

function utcMinuteStart(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), 0, 0))
}

function nextUtcMinuteStart(d: Date) {
  const start = utcMinuteStart(d)
  return new Date(start.getTime() + 60_000)
}

export type RateLimitResult = {
  limit: number
  remaining: number
  resetEpochSec: number
  retryAfterSec?: number
}

export async function consumeRateLimit(input: {
  orgId: string
  userId: string
  scope: RateLimitScope
  now?: Date
}): Promise<RateLimitResult> {
  const now = input.now ?? new Date()
  const limit = RATE_LIMITS_PER_MINUTE[input.scope]
  const windowStart = utcMinuteStart(now)
  const resetAt = nextUtcMinuteStart(now)
  const id = crypto.randomUUID()

  // Strict atomic consume: insert-or-increment only if count < limit.
  // Returns the new count if consumed; null if throttled.
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "ApiRateLimitWindow" ("id","orgId","userId","scope","windowStartUtcMinute","count","createdAt")
    VALUES (${id}, ${input.orgId}, ${input.userId}, ${input.scope}, ${windowStart}, 1, now())
    ON CONFLICT ("orgId","userId","scope","windowStartUtcMinute")
    DO UPDATE SET "count" = "ApiRateLimitWindow"."count" + 1
    WHERE "ApiRateLimitWindow"."count" < ${limit}
    RETURNING "count"
  `

  const consumed = rows[0]?.count ?? null
  if (consumed == null) {
    const retryAfterSec = Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000))
    const resetEpochSec = Math.floor(resetAt.getTime() / 1000)
    throw new ApiError({
      status: 429,
      code: "RATE_LIMITED",
      message: "Too many requests. Please retry shortly.",
      details: { scope: input.scope, retryAfterSec, limit, remaining: 0, resetEpochSec },
    })
  }

  const remaining = Math.max(0, limit - consumed)
  return {
    limit,
    remaining,
    resetEpochSec: Math.floor(resetAt.getTime() / 1000),
  }
}

export function rateLimitHeaders(r: RateLimitResult) {
  const h = new Headers()
  h.set("RateLimit-Limit", String(r.limit))
  h.set("RateLimit-Remaining", String(r.remaining))
  h.set("RateLimit-Reset", String(r.resetEpochSec))
  if (r.retryAfterSec != null) h.set("Retry-After", String(r.retryAfterSec))
  return h
}
