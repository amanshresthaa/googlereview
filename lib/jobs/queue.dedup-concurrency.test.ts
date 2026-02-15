import { afterEach, describe, expect, it } from "vitest"

import { prisma } from "@/lib/db"
import { enqueueJob } from "@/lib/jobs/queue"

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

describe("enqueueJob PROCESS_REVIEW dedup concurrency contract", () => {
  afterEach(async () => {
    const orgs = await prisma.organization.findMany({
      where: { id: { startsWith: "test-org-queue-dedup-" } },
      select: { id: true },
    })
    for (const org of orgs) {
      await cleanup(org.id)
    }
  })

  it("returns the same in-flight job when concurrent requests race with the same dedup key", async () => {
    const orgId = `test-org-queue-dedup-${uuid()}`
    const reviewId = `review-${uuid()}`
    const dedupKey = `review:${reviewId}:generate`
    await ensureOrg(orgId)

    const jobs = await Promise.all(
      Array.from({ length: 8 }, () =>
        enqueueJob({
          orgId,
          type: "PROCESS_REVIEW",
          payload: { reviewId, mode: "MANUAL_REGENERATE" },
          dedupKey,
        }),
      ),
    )

    const uniqueIds = new Set(jobs.map((job) => job.id))
    expect(uniqueIds.size).toBe(1)

    const inflight = await prisma.job.findMany({
      where: {
        orgId,
        type: "PROCESS_REVIEW",
        dedupKey,
        status: { in: ["PENDING", "RUNNING", "RETRYING"] },
      },
      select: { id: true },
    })
    expect(inflight).toHaveLength(1)
    expect(inflight[0]?.id).toBe(jobs[0]?.id)
  })
})
