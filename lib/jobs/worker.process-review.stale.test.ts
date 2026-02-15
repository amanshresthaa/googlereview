import { afterEach, describe, expect, it } from "vitest"

import { prisma } from "@/lib/db"
import { runProcessReviewFastPath } from "@/lib/jobs/worker"

function uuid() {
  return globalThis.crypto?.randomUUID?.() ?? "00000000-0000-4000-8000-000000000000"
}

async function cleanup(orgId: string) {
  await prisma.job.deleteMany({ where: { orgId } })
  await prisma.dspyRun.deleteMany({ where: { orgId } })
  await prisma.review.updateMany({ where: { orgId }, data: { currentDraftReplyId: null } })
  await prisma.draftReply.deleteMany({ where: { orgId } })
  await prisma.review.deleteMany({ where: { orgId } })
  await prisma.location.deleteMany({ where: { orgId } })
  await prisma.organization.deleteMany({ where: { id: orgId } })
}

async function seedStaleVerifyFixture(orgId: string) {
  await prisma.organization.create({
    data: {
      id: orgId,
      name: `Org ${orgId}`,
    },
  })

  const location = await prisma.location.create({
    data: {
      orgId,
      googleAccountId: `acct-${uuid()}`,
      googleLocationId: `loc-${uuid()}`,
      displayName: "Test Location",
      enabled: true,
    },
    select: { id: true },
  })

  const review = await prisma.review.create({
    data: {
      orgId,
      locationId: location.id,
      googleReviewName: `reviews/${uuid()}`,
      googleReviewId: uuid(),
      starRating: 5,
      comment: "Great service",
      createTime: new Date("2026-02-10T00:00:00.000Z"),
      updateTime: new Date("2026-02-10T00:00:00.000Z"),
      reviewerDisplayName: "Alex",
      reviewerIsAnonymous: false,
      mentions: [],
    },
    select: { id: true },
  })

  const currentDraft = await prisma.draftReply.create({
    data: {
      orgId,
      reviewId: review.id,
      version: 1,
      text: "Current draft",
      origin: "AUTO",
      status: "READY",
      evidenceSnapshotJson: { source: "test" } as never,
    },
    select: { id: true },
  })

  const staleDraft = await prisma.draftReply.create({
    data: {
      orgId,
      reviewId: review.id,
      version: 2,
      text: "Stale draft",
      origin: "AUTO",
      status: "READY",
      evidenceSnapshotJson: { source: "test" } as never,
    },
    select: { id: true },
  })

  await prisma.review.update({
    where: { id: review.id },
    data: {
      currentDraftReplyId: currentDraft.id,
    },
  })

  const job = await prisma.job.create({
    data: {
      orgId,
      type: "PROCESS_REVIEW",
      status: "PENDING",
      payload: {
        reviewId: review.id,
        mode: "VERIFY_EXISTING_DRAFT",
        draftReplyId: staleDraft.id,
      },
      runAt: new Date(),
      maxAttempts: 1,
    },
    select: { id: true },
  })

  return { jobId: job.id }
}

describe("PROCESS_REVIEW stale verify contract", () => {
  afterEach(async () => {
    const orgs = await prisma.organization.findMany({
      where: { id: { startsWith: "test-org-stale-" } },
      select: { id: true },
    })
    for (const org of orgs) {
      await cleanup(org.id)
    }
  })

  it("surfaces DRAFT_STALE when VERIFY_EXISTING_DRAFT targets a non-current draft", async () => {
    const orgId = `test-org-stale-${uuid()}`
    const { jobId } = await seedStaleVerifyFixture(orgId)

    const worker = await runProcessReviewFastPath({
      jobId,
      orgId,
      workerId: `fastpath:${uuid()}`,
      budgetMs: 15_000,
    })

    expect(worker.claimed).toBe(1)
    expect(worker.results[0]?.ok).toBe(false)
    expect(worker.results[0]?.error).toBe("DRAFT_STALE")

    const updated = await prisma.job.findUnique({
      where: { id: jobId },
      select: { status: true, lastErrorCode: true },
    })
    expect(updated?.status).toBe("FAILED")
    expect(updated?.lastErrorCode).toBe("DRAFT_STALE")
  })
})
