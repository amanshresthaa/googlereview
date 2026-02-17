import { afterEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/db"
import { runProcessReviewFastPath } from "@/lib/jobs/worker"

vi.mock("@/lib/jobs/handlers", () => {
  return {
    handleJob: vi.fn(async (_job: unknown, opts?: { signal?: AbortSignal }) => {
      // Simulate a long-running task that only stops when the fast-path budget aborts.
      await new Promise<void>((_resolve, reject) => {
        const signal = opts?.signal
        if (!signal) return reject(new Error("missing-signal"))
        if (signal.aborted) return reject(new Error("aborted"))
        signal.addEventListener(
          "abort",
          () => {
            reject(new Error("aborted"))
          },
          { once: true },
        )
      })
    }),
  }
})

function uuid() {
  return globalThis.crypto?.randomUUID?.() ?? "00000000-0000-4000-8000-000000000000"
}

async function cleanup(orgId: string) {
  await prisma.job.deleteMany({ where: { orgId } })
  await prisma.organization.deleteMany({ where: { id: orgId } })
}

async function ensureOrg(orgId: string) {
  await prisma.organization.upsert({
    where: { id: orgId },
    update: {},
    create: { id: orgId, name: `Test Org ${orgId}` },
  })
}

describe("runProcessReviewFastPath budget handling", () => {
  afterEach(async () => {
    vi.clearAllMocks()
  })

  it(
    "releases the lock without consuming attempts when fast-path budget is exhausted",
    { timeout: 10_000 },
    async () => {
    const orgId = `test-org-${uuid()}`
    await ensureOrg(orgId)

    const job = await prisma.job.create({
      data: {
        orgId,
        type: "PROCESS_REVIEW",
        status: "PENDING",
        payload: { reviewId: "review-1", mode: "AUTO" },
        runAt: new Date(),
      },
      select: { id: true },
    })

    const before = await prisma.job.findUnique({
      where: { id: job.id },
      select: { attempts: true },
    })

    const worker = await runProcessReviewFastPath({
      jobId: job.id,
      orgId,
      workerId: `fastpath:${uuid()}`,
      budgetMs: 5,
    })

    expect(worker.claimed).toBe(1)
    expect(worker.results[0]?.ok).toBe(false)
    expect(worker.results[0]?.error).toBe("FASTPATH_BUDGET_EXHAUSTED")

    const after = await prisma.job.findUnique({
      where: { id: job.id },
      select: { status: true, lockedAt: true, lockedBy: true, attempts: true },
    })
    expect(after?.status).toBe("RETRYING")
    expect(after?.lockedAt).toBeNull()
    expect(after?.lockedBy).toBeNull()
    expect(after?.attempts ?? null).toBe(before?.attempts ?? null)

    await cleanup(orgId)
    },
  )

  it(
    "marks the job failed with FASTPATH_TIMEOUT when maxAttempts is 1",
    { timeout: 10_000 },
    async () => {
    const orgId = `test-org-${uuid()}`
    await ensureOrg(orgId)

    const job = await prisma.job.create({
      data: {
        orgId,
        type: "PROCESS_REVIEW",
        status: "PENDING",
        payload: { reviewId: "review-2", mode: "AUTO" },
        runAt: new Date(),
        maxAttempts: 1,
      },
      select: { id: true },
    })

    const worker = await runProcessReviewFastPath({
      jobId: job.id,
      orgId,
      workerId: `fastpath:${uuid()}`,
      budgetMs: 5,
    })

    expect(worker.claimed).toBe(1)
    expect(worker.results[0]?.ok).toBe(false)
    expect(worker.results[0]?.error).toBe("FASTPATH_TIMEOUT")

    const after = await prisma.job.findUnique({
      where: { id: job.id },
      select: { status: true, lockedAt: true, lockedBy: true, lastErrorCode: true },
    })
    expect(after?.status).toBe("FAILED")
    expect(after?.lockedAt).toBeNull()
    expect(after?.lockedBy).toBeNull()
    expect(after?.lastErrorCode).toBe("FASTPATH_TIMEOUT")

    await cleanup(orgId)
    },
  )
})
