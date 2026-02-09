import { prisma } from "@/lib/db"
import { enqueueJob } from "@/lib/jobs/queue"

export async function scheduleReviewSyncJobs(input: {
  minStalenessMs: number
  limit: number
}) {
  const cutoff = new Date(Date.now() - input.minStalenessMs)
  const locations = await prisma.location.findMany({
    where: {
      enabled: true,
      OR: [{ lastReviewsSyncAt: null }, { lastReviewsSyncAt: { lt: cutoff } }],
    },
    orderBy: [{ lastReviewsSyncAt: "asc" }],
    take: input.limit,
    select: { id: true, orgId: true },
  })

  let scheduled = 0
  for (const loc of locations) {
    const existing = await prisma.job.findFirst({
      where: {
        orgId: loc.orgId,
        type: "SYNC_REVIEWS",
        status: { in: ["PENDING", "RETRYING", "RUNNING"] },
        payload: { path: ["locationId"], equals: loc.id },
      },
      select: { id: true },
    })
    if (existing) continue

    await enqueueJob({
      orgId: loc.orgId,
      type: "SYNC_REVIEWS",
      payload: { locationId: loc.id },
    })
    scheduled += 1
  }

  return { scheduled, examined: locations.length }
}

