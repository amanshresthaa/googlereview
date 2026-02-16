import { afterEach, describe, expect, it } from "vitest"

import { prisma } from "@/lib/db"
import { runPostReplyFastPath } from "@/lib/jobs/worker"

function uuid() {
  return globalThis.crypto?.randomUUID?.() ?? "00000000-0000-4000-8000-000000000000"
}

async function cleanup(orgId: string) {
  await prisma.job.deleteMany({ where: { orgId } })
  await prisma.review.updateMany({ where: { orgId }, data: { currentDraftReplyId: null } })
  await prisma.draftReply.deleteMany({ where: { orgId } })
  await prisma.review.deleteMany({ where: { orgId } })
  await prisma.location.deleteMany({ where: { orgId } })
  await prisma.organization.deleteMany({ where: { id: orgId } })
}

async function seedPostReplyFixture(orgId: string) {
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
      googleReviewName: `accounts/acct-${uuid()}/locations/loc-${uuid()}/reviews/rev-${uuid()}`,
      googleReviewId: uuid(),
      starRating: 5,
      comment: "Great service",
      createTime: new Date("2026-02-10T00:00:00.000Z"),
      updateTime: new Date("2026-02-10T00:00:00.000Z"),
      reviewerDisplayName: "Alex",
      reviewerIsAnonymous: false,
      mentions: [],
      googleReplyComment: "Already replied from remote sync",
      googleReplyUpdateTime: new Date("2026-02-11T00:00:00.000Z"),
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
      type: "POST_REPLY",
      status: "PENDING",
      payload: {
        reviewId: review.id,
        draftReplyId: staleDraft.id,
        actorUserId: `user-${uuid()}`,
      },
      runAt: new Date(),
      maxAttempts: 1,
    },
    select: { id: true },
  })

  return { jobId: job.id, currentDraftId: currentDraft.id, staleDraftId: staleDraft.id }
}

describe("POST_REPLY current draft resolution", () => {
  afterEach(async () => {
    const orgs = await prisma.organization.findMany({
      where: { id: { startsWith: "test-org-post-current-" } },
      select: { id: true },
    })
    for (const org of orgs) {
      await cleanup(org.id)
    }
  })

  it("uses the current draft when queued payload references a stale draft", async () => {
    const orgId = `test-org-post-current-${uuid()}`
    const { jobId, currentDraftId, staleDraftId } = await seedPostReplyFixture(orgId)

    const worker = await runPostReplyFastPath({
      jobId,
      orgId,
      workerId: `fastpath:${uuid()}`,
      budgetMs: 10_000,
    })

    expect(worker.claimed).toBe(1)
    expect(worker.results[0]?.ok).toBe(true)

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { status: true, lastErrorCode: true },
    })
    expect(job?.status).toBe("COMPLETED")
    expect(job?.lastErrorCode).toBeNull()

    const current = await prisma.draftReply.findUnique({
      where: { id: currentDraftId },
      select: { status: true },
    })
    const stale = await prisma.draftReply.findUnique({
      where: { id: staleDraftId },
      select: { status: true },
    })
    expect(current?.status).toBe("POSTED")
    expect(stale?.status).toBe("READY")
  })
})
