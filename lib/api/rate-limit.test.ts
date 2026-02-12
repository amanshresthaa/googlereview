import { afterEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/db"

vi.mock("@/lib/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/session")>("@/lib/session")
  return {
    ...actual,
    requireApiSession: vi.fn(),
    requireApiSessionWithTiming: vi.fn(),
  }
})

import { requireApiSessionWithTiming } from "@/lib/session"
import { handleAuthedPost } from "@/lib/api/handler"

type MockedRequireApiSessionWithTiming = typeof requireApiSessionWithTiming & {
  mockResolvedValue: (v: unknown) => void
}

function uuid() {
  return globalThis.crypto?.randomUUID?.() ?? "00000000-0000-4000-8000-000000000000"
}

async function cleanup(orgId: string, userId: string) {
  await prisma.apiIdempotencyKey.deleteMany({ where: { orgId, userId } })
  await prisma.apiRateLimitWindow.deleteMany({ where: { orgId, userId } })
}

describe("rate limiting", () => {
  afterEach(async () => {
    vi.clearAllMocks()
  })

  it("returns 429 RATE_LIMITED with RateLimit headers once limit exceeded", async () => {
    const orgId = `test-org-${uuid()}`
    const userId = `test-user-${uuid()}`
    ;(requireApiSessionWithTiming as unknown as MockedRequireApiSessionWithTiming).mockResolvedValue({
      session: {
        orgId,
        role: "OWNER",
        user: { id: userId },
        expires: "2099-01-01T00:00:00.000Z",
      },
      timing: {
        getSessionMs: 0,
        membershipMs: 0,
        cacheHit: false,
        inflightHit: false,
        grantHit: false,
        totalAuthMs: 0,
      },
      membershipGrantValue: null,
    })

    try {
      // Avoid flakiness when the test happens to run across a UTC minute boundary.
      // The rate limiter windows are keyed by UTC minute start.
      vi.useFakeTimers()
      vi.setSystemTime(new Date(Date.UTC(2026, 1, 10, 12, 34, 30)))

      // BULK_APPROVE limit is 2/min in the locked config.
      const url = "http://localhost/api/replies/bulk-approve"
      const call = async () => {
        const key = uuid()
        const req = new Request(url, {
          method: "POST",
          headers: { "content-type": "application/json", "Idempotency-Key": key },
          body: JSON.stringify({ reviewIds: ["a"] }),
        })
        return handleAuthedPost(
          req,
          { rateLimitScope: "BULK_APPROVE", idempotency: { required: true } },
          async () => ({ body: { ok: true } })
        )
      }

      const r1 = await call()
      expect(r1.status).toBe(200)
      const r2 = await call()
      expect(r2.status).toBe(200)

      const r3 = await call()
      expect(r3.status).toBe(429)
      const j3 = await r3.json()
      expect(j3).toMatchObject({ ok: false, error: "RATE_LIMITED" })
      expect(r3.headers.get("Retry-After")).toBeTruthy()
      expect(r3.headers.get("RateLimit-Limit")).toBe("2")
      expect(r3.headers.get("RateLimit-Remaining")).toBe("0")
      expect(Number(r3.headers.get("RateLimit-Reset"))).toBeGreaterThan(0)
      expect(r3.headers.get("X-Request-Id")).toBe(j3.requestId)
    } finally {
      vi.useRealTimers()
      await cleanup(orgId, userId)
    }
  }, 20_000)
})
