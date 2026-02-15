import { enqueueJob } from "@/lib/jobs/queue"
import { runProcessReviewFastPath } from "@/lib/jobs/worker"
import { prisma } from "@/lib/db"

function uid(prefix: string) {
  const rand = Math.random().toString(36).slice(2, 10)
  return `${prefix}-${Date.now()}-${rand}`
}

async function main() {
  const orgId = uid("org")

  try {
    await prisma.organization.create({
      data: {
        id: orgId,
        name: "DSPy Integration Validation Org",
        settings: {
          create: {
            tonePreset: "friendly",
            autoDraftEnabled: true,
            autoDraftForRatings: [5],
            bulkApproveEnabledForFiveStar: true,
            mentionKeywords: ["staff", "clean"],
            dspyConfigJson: {
              programVersion: "org-default-v1",
              draftModel: "openai/gpt-4o-mini",
              verifyModel: "openai/gpt-4.1-mini",
              experiments: [
                {
                  id: "org-exp-a",
                  trafficPercent: 100,
                  programVersion: "org-exp-v1",
                },
              ],
            } as never,
          },
        },
      },
    })

    const location = await prisma.location.create({
      data: {
        orgId,
        googleAccountId: uid("acct"),
        googleLocationId: uid("loc"),
        displayName: "Validation Location",
        enabled: true,
        dspyConfigJson: {
          programVersion: "loc-default-v2",
          draftModel: "openai/gpt-4.1-mini",
          verifyModel: "openai/gpt-4.1-mini",
          experiments: [
            {
              id: "loc-exp-a",
              trafficPercent: 100,
              programVersion: "loc-exp-v2",
              draftModel: "openai/gpt-4.1-mini",
              verifyModel: "openai/gpt-4.1-mini",
            },
          ],
        } as never,
      },
      select: { id: true },
    })

    const review = await prisma.review.create({
      data: {
        orgId,
        locationId: location.id,
        googleReviewName: uid("reviews"),
        googleReviewId: uid("rid"),
        starRating: 5,
        comment: "Amazing stay. Friendly staff and spotless room.",
        createTime: new Date(),
        updateTime: new Date(),
        reviewerDisplayName: "Integration User",
        reviewerIsAnonymous: false,
        mentions: [],
      },
      select: { id: true },
    })

    const job = await enqueueJob({
      orgId,
      type: "PROCESS_REVIEW",
      payload: {
        reviewId: review.id,
        mode: "MANUAL_REGENERATE",
        budgetOverride: { enabled: true, reason: "integration validation" },
      },
      dedupKey: `review:${review.id}:integration`,
      maxAttemptsOverride: 1,
      triggeredByRequestId: uid("req"),
      triggeredByUserId: uid("user"),
    })

    const worker = await runProcessReviewFastPath({
      jobId: job.id,
      orgId,
      workerId: uid("worker"),
      budgetMs: 15_000,
    })

    const finalJob = await prisma.job.findUnique({
      where: { id: job.id },
      select: {
        status: true,
        lastErrorCode: true,
        lastErrorMetaJson: true,
      },
    })

    const run = await prisma.dspyRun.findFirst({
      where: { orgId, reviewId: review.id },
      orderBy: { createdAt: "desc" },
      select: {
        status: true,
        experimentId: true,
        programVersion: true,
        draftModel: true,
        verifyModel: true,
        executionConfigJson: true,
        errorCode: true,
      },
    })

    console.log(
      JSON.stringify(
        {
          worker,
          job: finalJob,
          dspyRun: run,
          expected: {
            experimentId: "loc-exp-a",
            programVersion: "loc-exp-v2",
          },
        },
        null,
        2,
      ),
    )
  } finally {
    await prisma.organization.deleteMany({ where: { id: orgId } })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
