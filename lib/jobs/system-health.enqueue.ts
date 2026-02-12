import { prisma } from "@/lib/db"
import { ApiError } from "@/lib/api/errors"
import { enqueueJob } from "@/lib/jobs/queue"
import { jobEnqueueSchema, type JobEnqueueInput } from "@/lib/jobs/system-health.schemas"
import { writeAuditLog } from "@/lib/jobs/system-health.audit"

export async function enqueueJobsForOrg(input: {
  orgId: string
  requestId: string
  actorUserId: string
  body: unknown
}) {
  const parsed = jobEnqueueSchema.safeParse(input.body)
  if (!parsed.success) {
    throw new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid body." })
  }

  const body = parsed.data as JobEnqueueInput
  const now = new Date()

  if (body.type === "SYNC_LOCATIONS") {
    const job = await enqueueJob({
      orgId: input.orgId,
      type: "SYNC_LOCATIONS",
      payload: {},
      dedupKey: "manual:sync_locations",
      triggeredByRequestId: input.requestId,
      triggeredByUserId: input.actorUserId,
      runAt: now,
    })

    await writeAuditLog({
      orgId: input.orgId,
      actorUserId: input.actorUserId,
      action: "JOB_ENQUEUE",
      entityType: "JobBatch",
      entityId: input.requestId,
      metadata: { type: "SYNC_LOCATIONS", jobIds: [job.id], requestId: input.requestId },
    })

    return { jobIds: [job.id] }
  }

  if (body.type === "SYNC_REVIEWS") {
    if (body.mode === "ONE_LOCATION") {
      if (!body.locationId) {
        throw new ApiError({
          status: 400,
          code: "BAD_REQUEST",
          message: "locationId is required for ONE_LOCATION.",
          fields: { locationId: ["Required"] },
        })
      }
      const job = await enqueueJob({
        orgId: input.orgId,
        type: "SYNC_REVIEWS",
        payload: { locationId: body.locationId },
        dedupKey: `manual:sync_reviews:${body.locationId}`,
        triggeredByRequestId: input.requestId,
        triggeredByUserId: input.actorUserId,
        runAt: now,
      })

      await writeAuditLog({
        orgId: input.orgId,
        actorUserId: input.actorUserId,
        action: "JOB_ENQUEUE",
        entityType: "JobBatch",
        entityId: input.requestId,
        metadata: { type: "SYNC_REVIEWS", mode: "ONE_LOCATION", locationId: body.locationId, jobIds: [job.id], requestId: input.requestId },
      })

      return { jobIds: [job.id] }
    }

    const jobIds: string[] = []
    let cursorId: string | null = null
    for (;;) {
      const page: Array<{ id: string }> = await prisma.location.findMany({
        where: { orgId: input.orgId, enabled: true },
        orderBy: { id: "asc" },
        take: 500,
        ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
        select: { id: true },
      })
      if (page.length === 0) break

      for (const loc of page) {
        const created = await enqueueJob({
          orgId: input.orgId,
          type: "SYNC_REVIEWS",
          payload: { locationId: loc.id },
          dedupKey: `manual:sync_reviews:${loc.id}`,
          triggeredByRequestId: input.requestId,
          triggeredByUserId: input.actorUserId,
          runAt: now,
        })
        jobIds.push(created.id)
      }

      cursorId = page[page.length - 1]?.id ?? null
      if (page.length < 500) break
    }

    await writeAuditLog({
      orgId: input.orgId,
      actorUserId: input.actorUserId,
      action: "JOB_ENQUEUE",
      entityType: "JobBatch",
      entityId: input.requestId,
      metadata: { type: "SYNC_REVIEWS", mode: "ALL_ENABLED", jobIds, createdCount: jobIds.length, requestId: input.requestId },
    })

    return { jobIds }
  }

  throw new ApiError({ status: 400, code: "BAD_REQUEST", message: "Unsupported enqueue type." })
}

