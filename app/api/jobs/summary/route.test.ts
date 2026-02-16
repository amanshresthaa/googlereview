import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw: vi.fn(),
    job: {
      findMany: vi.fn(),
    },
    dspyRun: {
      groupBy: vi.fn(),
    },
  },
}))

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}))

vi.mock("@/lib/api/handler", () => ({
  handleAuthedGet: vi.fn(async (req: Request, handler: (ctx: unknown) => Promise<{
    status?: number
    body: unknown
    headers?: HeadersInit
  }>) => {
    const url = new URL(req.url)
    const orgId = req.headers.get("x-org-id") ?? "org-default"
    try {
      const result = await handler({
        requestId: "test-request",
        path: url.pathname,
        url,
        authMs: 0,
        session: {
          orgId,
          user: { id: "user-1" },
          expires: "2099-01-01T00:00:00.000Z",
        },
      })
      return new Response(JSON.stringify(result.body), {
        status: result.status ?? 200,
        headers: result.headers,
      })
    } catch (error) {
      const status =
        error && typeof error === "object" && "status" in error
          ? Number((error as { status?: unknown }).status) || 500
          : 500
      const message = error instanceof Error ? error.message : "Internal error"
      return new Response(JSON.stringify({ error: message }), { status })
    }
  }),
}))

import { GET } from "@/app/api/jobs/summary/route"

describe("/api/jobs/summary route", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-02-16T12:00:00.000Z"))
    prismaMock.$queryRaw.mockReset()
    prismaMock.job.findMany.mockReset()
    prismaMock.dspyRun.groupBy.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("serves stale summary when recompute fails after cache expiry", async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([
        {
          type: "SYNC_LOCATIONS",
          pending: 2,
          running: 1,
          retrying: 0,
          failed_24h: 0,
        },
      ])
      .mockRejectedValueOnce(new Error("Can't reach database server at aws-1-us-east-1.pooler.supabase.com"))

    const first = await GET(
      new Request("http://localhost/api/jobs/summary", {
        headers: { "x-org-id": "org-stale" },
      }),
    )
    expect(first.status).toBe(200)
    const firstJson = (await first.json()) as { summary?: { byType?: Record<string, { pending: number }> } }
    expect(firstJson.summary?.byType?.SYNC_LOCATIONS?.pending).toBe(2)

    vi.setSystemTime(new Date("2026-02-16T12:00:11.000Z"))

    const second = await GET(
      new Request("http://localhost/api/jobs/summary", {
        headers: { "x-org-id": "org-stale" },
      }),
    )
    expect(second.status).toBe(200)
    expect(second.headers.get("X-Data-Stale")).toBe("1")

    const secondJson = (await second.json()) as { summary?: { byType?: Record<string, { pending: number }> } }
    expect(secondJson.summary?.byType?.SYNC_LOCATIONS?.pending).toBe(2)
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2)
  })

  it("returns 503 when summary cannot be computed and no stale cache exists", async () => {
    prismaMock.$queryRaw.mockRejectedValueOnce(
      new Error("Can't reach database server at aws-1-us-east-1.pooler.supabase.com"),
    )

    const res = await GET(
      new Request("http://localhost/api/jobs/summary", {
        headers: { "x-org-id": "org-no-cache" },
      }),
    )
    expect(res.status).toBe(503)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toBe("Job summary is temporarily unavailable.")
  })
})
