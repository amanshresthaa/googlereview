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

describe("handleAuthedPost idempotency", () => {
  afterEach(async () => {
    vi.clearAllMocks()
  })

  it("returns 428 when Idempotency-Key missing", async () => {
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

    const req = new Request("http://localhost/api/settings/update", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    })

    const res = await handleAuthedPost(
      req,
      { rateLimitScope: "SETTINGS_UPDATE", idempotency: { required: true } },
      async () => ({ body: {} })
    )

    expect(res.status).toBe(428)
    const json = await res.json()
    expect(json).toMatchObject({ ok: false, error: "IDEMPOTENCY_KEY_REQUIRED" })
    expect(typeof json.requestId).toBe("string")
  })

  it("replays identical response (status/body/requestId) for same key+hash", async () => {
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

    const key = uuid()
    const url = "http://localhost/api/replies/bulk-approve"
    const makeReq = (body: unknown) =>
      new Request(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": key,
        },
        body: JSON.stringify(body),
      })

    const res1 = await handleAuthedPost(
      makeReq({ reviewIds: ["a"] }),
      { rateLimitScope: "BULK_APPROVE", idempotency: { required: true } },
      async ({ requestId }) => ({
        status: 201,
        body: { echo: "ok", requestIdSeenByHandler: requestId },
      })
    )
    expect(res1.status).toBe(201)
    const json1 = await res1.json()
    expect(json1.ok).toBe(true)
    expect(json1.requestId).toBeTruthy()
    expect(res1.headers.get("X-Request-Id")).toBe(json1.requestId)

    const res2 = await handleAuthedPost(
      makeReq({ reviewIds: ["a"] }),
      { rateLimitScope: "BULK_APPROVE", idempotency: { required: true } },
      async () => ({ status: 500, body: { shouldNotRun: true } })
    )
    expect(res2.status).toBe(201)
    const json2 = await res2.json()
    expect(json2).toEqual(json1)
    expect(res2.headers.get("X-Request-Id")).toBe(json1.requestId)

    await cleanup(orgId, userId)
  })

  it("returns 409 IDEMPOTENCY_KEY_REUSED when key reused with different payload", async () => {
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

    const key = uuid()
    const url = "http://localhost/api/settings/update"

    const res1 = await handleAuthedPost(
      new Request(url, {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify({ a: 1 }),
      }),
      { rateLimitScope: "SETTINGS_UPDATE", idempotency: { required: true } },
      async () => ({ body: { ok1: true } })
    )
    const json1 = await res1.json()
    expect(json1.ok).toBe(true)

    const res2 = await handleAuthedPost(
      new Request(url, {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify({ a: 2 }),
      }),
      { rateLimitScope: "SETTINGS_UPDATE", idempotency: { required: true } },
      async () => ({ body: { ok2: true } })
    )
    expect(res2.status).toBe(409)
    const json2 = await res2.json()
    expect(json2).toMatchObject({ ok: false, error: "IDEMPOTENCY_KEY_REUSED" })
    expect(typeof json2.requestId).toBe("string")
    expect(json2.requestId).toBe(json1.requestId)

    await cleanup(orgId, userId)
  })

  it("returns 409 IDEMPOTENCY_SCOPE_MISMATCH when key reused for different path", async () => {
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

    const key = uuid()

    const res1 = await handleAuthedPost(
      new Request("http://localhost/api/one", {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify({}),
      }),
      { rateLimitScope: "SETTINGS_UPDATE", idempotency: { required: true } },
      async () => ({ body: { one: true } })
    )
    const json1 = await res1.json()
    expect(json1.ok).toBe(true)

    const res2 = await handleAuthedPost(
      new Request("http://localhost/api/two", {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify({}),
      }),
      { rateLimitScope: "SETTINGS_UPDATE", idempotency: { required: true } },
      async () => ({ body: { two: true } })
    )
    expect(res2.status).toBe(409)
    const json2 = await res2.json()
    expect(json2).toMatchObject({ ok: false, error: "IDEMPOTENCY_SCOPE_MISMATCH" })
    expect(json2.requestId).toBe(json1.requestId)

    await cleanup(orgId, userId)
  })
})
