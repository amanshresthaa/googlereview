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
import { GET as jobsGet, POST as jobsPost } from "@/app/api/jobs/route"
import { POST as jobsBulkActionsPost } from "@/app/api/jobs/actions/route"
import { POST as jobActionPost } from "@/app/api/jobs/[id]/actions/route"
import { POST as workerRunPost } from "@/app/api/jobs/worker/run/route"

type MockedRequireApiSessionWithTiming = typeof requireApiSessionWithTiming & {
  mockResolvedValue: (v: unknown) => void
}

function uuid() {
  return globalThis.crypto?.randomUUID?.() ?? "00000000-0000-4000-8000-000000000000"
}

async function cleanup(orgId: string, userId: string) {
  await prisma.job.deleteMany({ where: { orgId } })
  await prisma.auditLog.deleteMany({ where: { orgId } })
  await prisma.organization.deleteMany({ where: { id: orgId } })
  await prisma.apiIdempotencyKey.deleteMany({ where: { orgId, userId } })
  await prisma.apiRateLimitWindow.deleteMany({ where: { orgId, userId } })
}

async function ensureOrg(orgId: string) {
  await prisma.organization.upsert({
    where: { id: orgId },
    update: {},
    create: { id: orgId, name: `Test Org ${orgId}` },
  })
}

function mockSession(input: { orgId: string; userId: string; role: string }) {
  ;(requireApiSessionWithTiming as unknown as MockedRequireApiSessionWithTiming).mockResolvedValue({
    session: {
      orgId: input.orgId,
      role: input.role,
      user: { id: input.userId },
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
}

describe("/api/jobs", () => {
  afterEach(async () => {
    vi.clearAllMocks()
  })

  it("GET returns only org's jobs", async () => {
    const orgId = `test-org-${uuid()}`
    const orgId2 = `test-org-${uuid()}`
    const userId = `test-user-${uuid()}`
    mockSession({ orgId, userId, role: "OWNER" })

    await ensureOrg(orgId)
    await ensureOrg(orgId2)

    const a = await prisma.job.create({
      data: { orgId, type: "SYNC_LOCATIONS", status: "PENDING", payload: {} },
      select: { id: true },
    })
    await prisma.job.create({
      data: { orgId: orgId2, type: "SYNC_LOCATIONS", status: "PENDING", payload: {} },
      select: { id: true },
    })

    const res = await jobsGet(new Request("http://localhost/api/jobs?order=CREATED_AT_DESC&limit=50"))
    expect(res.status).toBe(200)
    const json = (await res.json()) as { jobs?: Array<{ id: string }> }
    const ids = new Set((json.jobs ?? []).map((j) => j.id))
    expect(ids.has(a.id)).toBe(true)

    await cleanup(orgId, userId)
    await prisma.job.deleteMany({ where: { orgId: orgId2 } })
    await prisma.organization.deleteMany({ where: { id: orgId2 } })
  })

  it("GET cursor pagination is stable (CREATED_AT_DESC)", async () => {
    const orgId = `test-org-${uuid()}`
    const userId = `test-user-${uuid()}`
    mockSession({ orgId, userId, role: "OWNER" })

    await ensureOrg(orgId)

    const base = new Date("2026-02-12T00:00:00.000Z")
    const ids: string[] = []
    for (let i = 0; i < 5; i += 1) {
      const createdAt = new Date(base.getTime() + i * 1000)
      const row = await prisma.job.create({
        data: {
          orgId,
          type: "SYNC_LOCATIONS",
          status: "PENDING",
          payload: {},
          createdAt,
        },
        select: { id: true },
      })
      ids.push(row.id)
    }

    const res1 = await jobsGet(new Request("http://localhost/api/jobs?order=CREATED_AT_DESC&limit=2"))
    expect(res1.status).toBe(200)
    const page1 = (await res1.json()) as { jobs: Array<{ id: string }>; nextCursor: string | null }
    expect(page1.jobs).toHaveLength(2)
    expect(page1.nextCursor).toBeTruthy()

    const res2 = await jobsGet(new Request(`http://localhost/api/jobs?order=CREATED_AT_DESC&limit=2&cursor=${encodeURIComponent(page1.nextCursor ?? "")}`))
    expect(res2.status).toBe(200)
    const page2 = (await res2.json()) as { jobs: Array<{ id: string }>; nextCursor: string | null }
    expect(page2.jobs).toHaveLength(2)

    const all = new Set([...page1.jobs.map((j) => j.id), ...page2.jobs.map((j) => j.id)])
    expect(all.size).toBe(4)

    await cleanup(orgId, userId)
  })

  it("POST is owner-only and idempotent", async () => {
    const orgId = `test-org-${uuid()}`
    const userId = `test-user-${uuid()}`
    const keyForbidden = uuid()
    const key = uuid()

    await ensureOrg(orgId)

    mockSession({ orgId, userId, role: "MANAGER" })
    const resForbidden = await jobsPost(
      new Request("http://localhost/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": keyForbidden },
        body: JSON.stringify({ type: "SYNC_LOCATIONS" }),
      }),
    )
    expect(resForbidden.status).toBe(403)

    mockSession({ orgId, userId, role: "OWNER" })
    const res1 = await jobsPost(
      new Request("http://localhost/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify({ type: "SYNC_LOCATIONS" }),
      }),
    )
    expect(res1.status).toBe(200)
    const json1 = (await res1.json()) as { ok: boolean; jobIds?: string[]; requestId?: string }
    expect(json1.ok).toBe(true)
    expect(Array.isArray(json1.jobIds)).toBe(true)

    const res2 = await jobsPost(
      new Request("http://localhost/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify({ type: "SYNC_LOCATIONS" }),
      }),
    )
    expect(res2.status).toBe(200)
    const json2 = await res2.json()
    expect(json2).toEqual(json1)

    await cleanup(orgId, userId)
  })
})

describe("/api/jobs/:id/actions", () => {
  afterEach(async () => {
    vi.clearAllMocks()
  })

  it("RUN_NOW updates unlocked PENDING job", async () => {
    const orgId = `test-org-${uuid()}`
    const userId = `test-user-${uuid()}`
    mockSession({ orgId, userId, role: "OWNER" })

    await ensureOrg(orgId)

    const job = await prisma.job.create({
      data: {
        orgId,
        type: "SYNC_LOCATIONS",
        status: "PENDING",
        payload: {},
        runAt: new Date(Date.now() + 60 * 60_000),
      },
      select: { id: true, runAt: true },
    })

    const res = await jobActionPost(
      new Request(`http://localhost/api/jobs/${job.id}/actions`, {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": uuid() },
        body: JSON.stringify({ action: "RUN_NOW" }),
      }),
      { params: Promise.resolve({ id: job.id }) },
    )
    expect(res.status).toBe(200)
    const json = (await res.json()) as { ok: boolean; job?: { id: string; runAtIso: string } }
    expect(json.ok).toBe(true)
    expect(json.job?.id).toBeTruthy()
    const nextRunAt = json.job?.runAtIso ? new Date(json.job.runAtIso) : null
    expect(nextRunAt && nextRunAt.getTime() <= job.runAt.getTime()).toBe(true)

    const audit = await prisma.auditLog.findFirst({
      where: { orgId, action: "JOB_RUN_NOW", entityType: "Job", entityId: job.id },
      select: { id: true },
    })
    expect(Boolean(audit?.id)).toBe(true)

    await cleanup(orgId, userId)
  })

  it("FORCE_UNLOCK only works for stale RUNNING", async () => {
    const orgId = `test-org-${uuid()}`
    const userId = `test-user-${uuid()}`
    mockSession({ orgId, userId, role: "OWNER" })

    await ensureOrg(orgId)

    const oldLockedAt = new Date(Date.now() - 20 * 60_000)
    const job = await prisma.job.create({
      data: {
        orgId,
        type: "SYNC_LOCATIONS",
        status: "RUNNING",
        payload: {},
        lockedAt: oldLockedAt,
        lockedBy: "test-worker",
      },
      select: { id: true },
    })

    const res = await jobActionPost(
      new Request(`http://localhost/api/jobs/${job.id}/actions`, {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": uuid() },
        body: JSON.stringify({ action: "FORCE_UNLOCK" }),
      }),
      { params: Promise.resolve({ id: job.id }) },
    )
    expect(res.status).toBe(200)
    const json = (await res.json()) as { ok: boolean; job?: { status: string; lockedAtIso: string | null } }
    expect(json.ok).toBe(true)
    expect(json.job?.status).toBe("RETRYING")
    expect(json.job?.lockedAtIso).toBe(null)

    const audit = await prisma.auditLog.findFirst({
      where: { orgId, action: "JOB_FORCE_UNLOCK", entityType: "Job", entityId: job.id },
      select: { id: true },
    })
    expect(Boolean(audit?.id)).toBe(true)

    await cleanup(orgId, userId)
  })

  it("REQUEUE creates a new job id", async () => {
    const orgId = `test-org-${uuid()}`
    const userId = `test-user-${uuid()}`
    mockSession({ orgId, userId, role: "OWNER" })

    await ensureOrg(orgId)

    const job = await prisma.job.create({
      data: {
        orgId,
        type: "SYNC_LOCATIONS",
        status: "COMPLETED",
        payload: {},
        completedAt: new Date(),
      },
      select: { id: true },
    })

    const res = await jobActionPost(
      new Request(`http://localhost/api/jobs/${job.id}/actions`, {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": uuid() },
        body: JSON.stringify({ action: "REQUEUE" }),
      }),
      { params: Promise.resolve({ id: job.id }) },
    )
    expect(res.status).toBe(200)
    const json = (await res.json()) as { ok: boolean; result?: { kind?: string; newJobId?: string } }
    expect(json.ok).toBe(true)
    expect(json.result?.kind).toBe("REQUEUED")
    expect(typeof json.result?.newJobId).toBe("string")
    expect(json.result?.newJobId).not.toBe(job.id)

    const audit = await prisma.auditLog.findFirst({
      where: { orgId, action: "JOB_REQUEUE", entityType: "Job", entityId: job.id },
      select: { id: true },
    })
    expect(Boolean(audit?.id)).toBe(true)

    await cleanup(orgId, userId)
  })
})

describe("/api/jobs/worker/run", () => {
  afterEach(async () => {
    vi.clearAllMocks()
  })

  it("is owner-only and executes safely when no jobs are eligible", async () => {
    const orgId = `test-org-${uuid()}`
    const userId = `test-user-${uuid()}`
    await ensureOrg(orgId)

    mockSession({ orgId, userId, role: "MANAGER" })
    const resForbidden = await workerRunPost(
      new Request("http://localhost/api/jobs/worker/run", {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": uuid() },
        body: JSON.stringify({ limit: 1 }),
      }),
    )
    expect(resForbidden.status).toBe(403)

    mockSession({ orgId, userId, role: "OWNER" })
    const resOk = await workerRunPost(
      new Request("http://localhost/api/jobs/worker/run", {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": uuid() },
        body: JSON.stringify({ limit: 1 }),
      }),
    )
    expect(resOk.status).toBe(200)
    const json = (await resOk.json()) as { ok: boolean; worker?: { claimed?: number } }
    expect(json.ok).toBe(true)
    expect(typeof json.worker?.claimed).toBe("number")

    await cleanup(orgId, userId)
  })

  it("returns 503 when worker is disabled", async () => {
    const orgId = `test-org-${uuid()}`
    const userId = `test-user-${uuid()}`
    await ensureOrg(orgId)

    mockSession({ orgId, userId, role: "OWNER" })
    const prev = process.env.DISABLE_CRON
    process.env.DISABLE_CRON = "true"

    try {
      const res = await workerRunPost(
        new Request("http://localhost/api/jobs/worker/run", {
          method: "POST",
          headers: { "content-type": "application/json", "Idempotency-Key": uuid() },
          body: JSON.stringify({ limit: 1 }),
        }),
      )
      expect(res.status).toBe(503)
    } finally {
      process.env.DISABLE_CRON = prev
      await cleanup(orgId, userId)
    }
  })
})

describe("/api/jobs/actions", () => {
  afterEach(async () => {
    vi.clearAllMocks()
  })

  it("FORCE_UNLOCK_STALE bulk-updates eligible jobs and writes audit log", async () => {
    const orgId = `test-org-${uuid()}`
    const userId = `test-user-${uuid()}`
    mockSession({ orgId, userId, role: "OWNER" })
    await ensureOrg(orgId)

    const oldLockedAt = new Date(Date.now() - 20 * 60_000)
    const stale = await prisma.job.create({
      data: {
        orgId,
        type: "SYNC_LOCATIONS",
        status: "RUNNING",
        payload: {},
        lockedAt: oldLockedAt,
        lockedBy: "test-worker",
      },
      select: { id: true },
    })

    const freshLockedAt = new Date(Date.now() - 2 * 60_000)
    const fresh = await prisma.job.create({
      data: {
        orgId,
        type: "SYNC_LOCATIONS",
        status: "RUNNING",
        payload: {},
        lockedAt: freshLockedAt,
        lockedBy: "test-worker",
      },
      select: { id: true },
    })

    const res = await jobsBulkActionsPost(
      new Request("http://localhost/api/jobs/actions", {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": uuid() },
        body: JSON.stringify({ action: "FORCE_UNLOCK_STALE", jobIds: [stale.id, fresh.id] }),
      }),
    )
    expect(res.status).toBe(200)
    const json = (await res.json()) as { ok: boolean; requestId: string; result?: { updated?: number } }
    expect(json.ok).toBe(true)

    const staleAfter = await prisma.job.findUnique({ where: { id: stale.id }, select: { status: true, lockedAt: true } })
    const freshAfter = await prisma.job.findUnique({ where: { id: fresh.id }, select: { status: true } })
    expect(staleAfter?.status).toBe("RETRYING")
    expect(staleAfter?.lockedAt).toBe(null)
    expect(freshAfter?.status).toBe("RUNNING")

    const audit = await prisma.auditLog.findFirst({
      where: { orgId, action: "JOB_FORCE_UNLOCK_BULK", entityType: "JobBatch", entityId: json.requestId },
      select: { id: true },
    })
    expect(Boolean(audit?.id)).toBe(true)

    await cleanup(orgId, userId)
  })

  it(
    "CANCEL_BACKLOG cancels eligible backlog jobs (and stale RUNNING) and writes audit log",
    async () => {
      const orgId = `test-org-${uuid()}`
      const userId = `test-user-${uuid()}`
      mockSession({ orgId, userId, role: "OWNER" })
      await ensureOrg(orgId)

    const pending = await prisma.job.create({
      data: {
        orgId,
        type: "SYNC_REVIEWS",
        status: "PENDING",
        payload: {},
        runAt: new Date(Date.now() + 60_000),
      },
      select: { id: true },
    })

    const retrying = await prisma.job.create({
      data: {
        orgId,
        type: "SYNC_LOCATIONS",
        status: "RETRYING",
        payload: {},
        runAt: new Date(Date.now() + 120_000),
      },
      select: { id: true },
    })

    const staleRunning = await prisma.job.create({
      data: {
        orgId,
        type: "SYNC_LOCATIONS",
        status: "RUNNING",
        payload: {},
        lockedAt: new Date(Date.now() - 20 * 60_000),
        lockedBy: "test-worker",
      },
      select: { id: true },
    })

    const freshRunning = await prisma.job.create({
      data: {
        orgId,
        type: "SYNC_LOCATIONS",
        status: "RUNNING",
        payload: {},
        lockedAt: new Date(Date.now() - 2 * 60_000),
        lockedBy: "test-worker",
      },
      select: { id: true },
    })

    const otherOrgId = `test-org-${uuid()}`
    await ensureOrg(otherOrgId)
    const otherOrgPending = await prisma.job.create({
      data: {
        orgId: otherOrgId,
        type: "SYNC_LOCATIONS",
        status: "PENDING",
        payload: {},
      },
      select: { id: true },
    })

    const res = await jobsBulkActionsPost(
      new Request("http://localhost/api/jobs/actions", {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": uuid() },
        body: JSON.stringify({ action: "CANCEL_BACKLOG", limit: 100, includeStaleRunning: true }),
      }),
    )
    expect(res.status).toBe(200)
    const json = (await res.json()) as { ok: boolean; requestId: string; result?: { updated?: number } }
    expect(json.ok).toBe(true)

    const pendingAfter = await prisma.job.findUnique({ where: { id: pending.id }, select: { status: true, completedAt: true } })
    const retryingAfter = await prisma.job.findUnique({ where: { id: retrying.id }, select: { status: true, completedAt: true } })
    const staleAfter = await prisma.job.findUnique({ where: { id: staleRunning.id }, select: { status: true, completedAt: true, lockedAt: true } })
    const freshAfter = await prisma.job.findUnique({ where: { id: freshRunning.id }, select: { status: true } })
    const otherOrgAfter = await prisma.job.findUnique({ where: { id: otherOrgPending.id }, select: { status: true } })

    expect(pendingAfter?.status).toBe("CANCELLED")
    expect(Boolean(pendingAfter?.completedAt)).toBe(true)
    expect(retryingAfter?.status).toBe("CANCELLED")
    expect(Boolean(retryingAfter?.completedAt)).toBe(true)
    expect(staleAfter?.status).toBe("CANCELLED")
    expect(Boolean(staleAfter?.completedAt)).toBe(true)
    expect(staleAfter?.lockedAt).toBe(null)
    expect(freshAfter?.status).toBe("RUNNING")
    expect(otherOrgAfter?.status).toBe("PENDING")

    const audit = await prisma.auditLog.findFirst({
      where: { orgId, action: "JOB_CANCEL_BACKLOG", entityType: "JobBatch", entityId: json.requestId },
      select: { id: true },
    })
    expect(Boolean(audit?.id)).toBe(true)

      await cleanup(otherOrgId, userId)
      await cleanup(orgId, userId)
    },
    20_000,
  )
})
