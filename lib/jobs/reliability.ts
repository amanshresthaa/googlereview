import { prisma } from "@/lib/db"
import { CIRCUIT_BREAKER, COOLDOWN_MS, AI_DAILY_BUDGET_PER_ORG, POST_DAILY_BUDGET_PER_ORG } from "@/lib/api/limits"
import crypto from "node:crypto"
import { NonRetryableError, RetryableJobError } from "@/lib/jobs/errors"

type BudgetScope = "AI" | "POST_REPLY"

function utcDayIso(d: Date) {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function budgetLimit(scope: BudgetScope) {
  return scope === "AI" ? AI_DAILY_BUDGET_PER_ORG : POST_DAILY_BUDGET_PER_ORG
}

export async function consumeDailyBudgetOrThrow(input: {
  orgId: string
  scope: BudgetScope
  now?: Date
  bypass?: boolean
}) {
  if (input.bypass) return
  const now = input.now ?? new Date()
  const dayIso = utcDayIso(now)
  const limit = budgetLimit(input.scope)
  const id = crypto.randomUUID()

  const rows = await prisma.$queryRaw<Array<{ used: number }>>`
    INSERT INTO "ApiBudgetDaily" ("id","orgId","scope","dayIso","used","createdAt","updatedAt")
    VALUES (${id}, ${input.orgId}, ${input.scope}, ${dayIso}, 1, now(), now())
    ON CONFLICT ("orgId","scope","dayIso")
    DO UPDATE SET "used" = "ApiBudgetDaily"."used" + 1, "updatedAt" = now()
    WHERE "ApiBudgetDaily"."used" < ${limit}
    RETURNING "used"
  `

  if (!rows[0]?.used) {
    throw new NonRetryableError("BUDGET_EXCEEDED", "Daily budget exceeded.")
  }
}

export async function enforceCooldownOrThrow(input: {
  orgId: string
  scope: "GENERATE_DRAFT" | "VERIFY_DRAFT"
  key: string
  now?: Date
}) {
  const now = input.now ?? new Date()
  const row = await prisma.apiCooldown.findUnique({
    where: { orgId_scope_key: { orgId: input.orgId, scope: input.scope, key: input.key } },
    select: { availableAt: true },
  })
  if (!row) return
  if (row.availableAt.getTime() <= now.getTime()) return
  const retryAfterSec = Math.max(1, Math.ceil((row.availableAt.getTime() - now.getTime()) / 1000))
  throw new NonRetryableError("COOLDOWN_ACTIVE", "Cooldown active.", { retryAfterSec })
}

export async function setCooldownAfterSuccess(input: {
  orgId: string
  scope: "GENERATE_DRAFT" | "VERIFY_DRAFT"
  key: string
  now?: Date
}) {
  const now = input.now ?? new Date()
  const ms =
    input.scope === "GENERATE_DRAFT" ? COOLDOWN_MS.GENERATE_DRAFT_REVIEW : COOLDOWN_MS.VERIFY_DRAFT_DRAFT
  const availableAt = new Date(now.getTime() + ms)

  await prisma.apiCooldown.upsert({
    where: { orgId_scope_key: { orgId: input.orgId, scope: input.scope, key: input.key } },
    update: { availableAt },
    create: { orgId: input.orgId, scope: input.scope, key: input.key, availableAt },
  })
}

export async function breakerPrecheckOrThrow(input: { orgId: string; upstreamKey: string; now?: Date }) {
  const now = input.now ?? new Date()
  const row = await prisma.apiCircuitBreaker.findUnique({
    where: { orgId_upstreamKey: { orgId: input.orgId, upstreamKey: input.upstreamKey } },
    select: { state: true, openUntil: true },
  })
  if (!row) return
  if (row.state !== "OPEN") return
  if (!row.openUntil) return
  if (row.openUntil.getTime() <= now.getTime()) return
  const retryAfterSec = Math.max(1, Math.ceil((row.openUntil.getTime() - now.getTime()) / 1000))
  throw new RetryableJobError("UPSTREAM_5XX", "Upstream circuit breaker open.", { retryAfterSec })
}

export async function breakerRecordSuccess(input: { orgId: string; upstreamKey: string; now?: Date }) {
  const now = input.now ?? new Date()
  await prisma.$transaction(async (tx) => {
    const row = await tx.apiCircuitBreaker.findUnique({
      where: { orgId_upstreamKey: { orgId: input.orgId, upstreamKey: input.upstreamKey } },
    })
    if (!row) {
      await tx.apiCircuitBreaker.create({
        data: { orgId: input.orgId, upstreamKey: input.upstreamKey, state: "CLOSED" },
      })
      return
    }
    if (row.state === "HALF_OPEN") {
      const successes = (row.halfOpenSuccesses ?? 0) + 1
      if (successes >= CIRCUIT_BREAKER.HALF_OPEN_SUCCESSES_TO_CLOSE) {
        await tx.apiCircuitBreaker.update({
          where: { id: row.id },
          data: { state: "CLOSED", openUntil: null, windowStartUtc: null, windowFailures: 0, halfOpenSuccesses: 0 },
        })
      } else {
        await tx.apiCircuitBreaker.update({ where: { id: row.id }, data: { halfOpenSuccesses: successes } })
      }
    }
    if (row.state === "OPEN" && row.openUntil && row.openUntil.getTime() <= now.getTime()) {
      // Transition to half-open on first observed success after open window ends.
      await tx.apiCircuitBreaker.update({
        where: { id: row.id },
        data: { state: "HALF_OPEN", halfOpenSuccesses: 1 },
      })
    }
  })
}

export async function breakerRecordFailure(input: {
  orgId: string
  upstreamKey: string
  now?: Date
}) {
  const now = input.now ?? new Date()
  await prisma.$transaction(async (tx) => {
    const row = await tx.apiCircuitBreaker.findUnique({
      where: { orgId_upstreamKey: { orgId: input.orgId, upstreamKey: input.upstreamKey } },
    })
    if (!row) {
      await tx.apiCircuitBreaker.create({
        data: {
          orgId: input.orgId,
          upstreamKey: input.upstreamKey,
          state: "CLOSED",
          windowStartUtc: now,
          windowFailures: 1,
          halfOpenSuccesses: 0,
        },
      })
      return
    }

    // If OPEN expired, transition to HALF_OPEN on next attempt.
    if (row.state === "OPEN" && row.openUntil && row.openUntil.getTime() <= now.getTime()) {
      await tx.apiCircuitBreaker.update({
        where: { id: row.id },
        data: { state: "HALF_OPEN", openUntil: null, halfOpenSuccesses: 0, windowStartUtc: now, windowFailures: 1 },
      })
      return
    }

    if (row.state === "HALF_OPEN") {
      // Any failure in half-open immediately re-opens.
      await tx.apiCircuitBreaker.update({
        where: { id: row.id },
        data: { state: "OPEN", openUntil: new Date(now.getTime() + CIRCUIT_BREAKER.OPEN_MS), halfOpenSuccesses: 0 },
      })
      return
    }

    const windowStart = row.windowStartUtc
    const resetWindow = !windowStart || now.getTime() - windowStart.getTime() > CIRCUIT_BREAKER.WINDOW_MS
    const nextStart = resetWindow ? now : windowStart
    const nextFailures = resetWindow ? 1 : (row.windowFailures ?? 0) + 1

    if (nextFailures >= CIRCUIT_BREAKER.FAILURES_TO_OPEN) {
      await tx.apiCircuitBreaker.update({
        where: { id: row.id },
        data: {
          state: "OPEN",
          openUntil: new Date(now.getTime() + CIRCUIT_BREAKER.OPEN_MS),
          windowStartUtc: nextStart,
          windowFailures: nextFailures,
          halfOpenSuccesses: 0,
        },
      })
      return
    }

    await tx.apiCircuitBreaker.update({
      where: { id: row.id },
      data: { windowStartUtc: nextStart, windowFailures: nextFailures },
    })
  })
}

