import { afterEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/db"

vi.mock("@/lib/session", () => ({
  requireApiSession: vi.fn(),
}))

import { requireApiSession } from "@/lib/session"
import { handleAuthedPost } from "@/lib/api/handler"

type MockedRequireApiSession = typeof requireApiSession & { mockResolvedValue: (v: unknown) => void }

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
    ;(requireApiSession as unknown as MockedRequireApiSession).mockResolvedValue({
      orgId,
      role: "OWNER",
      user: { id: userId },
    })

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

    await cleanup(orgId, userId)
  })
})
