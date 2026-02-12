import { redirect } from "next/navigation"
import type { JobStatus } from "@prisma/client"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import { listJobsForOrg } from "@/lib/jobs/system-health"
import { SystemHealthClient } from "@/app/(app)/system-health/SystemHealthClient"

export default async function SystemHealthPage() {
  const session = await getSession()
  if (!session?.user?.id || !session.orgId) redirect("/signin")

  const workerDisabled = process.env.DISABLE_CRON === "true"

  const now = new Date()
  const since = new Date(now.getTime() - 24 * 60 * 60_000)
  const activeStatuses: JobStatus[] = ["PENDING", "RUNNING", "RETRYING"]

  const [activeGrouped, failedCounts, backlogPage, completedPage, enabledLocations] = await Promise.all([
    prisma.job.groupBy({
      by: ["status"],
      where: { orgId: session.orgId, status: { in: activeStatuses } },
      _count: { _all: true },
    }),
    prisma.job.count({
      where: { orgId: session.orgId, status: "FAILED", completedAt: { gte: since } },
    }),
    listJobsForOrg({
      orgId: session.orgId,
      filter: {
        status: ["PENDING", "RUNNING", "RETRYING"],
        order: "RUN_AT_ASC",
        limit: 50,
      },
    }),
    listJobsForOrg({
      orgId: session.orgId,
      filter: {
        status: ["COMPLETED", "FAILED", "CANCELLED"],
        order: "COMPLETED_AT_DESC",
        limit: 50,
      },
    }),
    prisma.location.findMany({
      where: { orgId: session.orgId, enabled: true },
      orderBy: { displayName: "asc" },
      take: 500,
      select: { id: true, displayName: true },
    }),
  ])

  let pending = 0
  let running = 0
  let retrying = 0
  for (const row of activeGrouped) {
    if (row.status === "PENDING") pending = row._count._all
    if (row.status === "RUNNING") running = row._count._all
    if (row.status === "RETRYING") retrying = row._count._all
  }

  return (
    <SystemHealthClient
      role={session.role ?? ""}
      workerDisabled={workerDisabled}
      initialNowIso={now.toISOString()}
      summary={{
        pending,
        running,
        retrying,
        backlog: pending + running + retrying,
        failed24h: failedCounts,
      }}
      initialBacklog={backlogPage}
      initialCompleted={completedPage}
      enabledLocations={enabledLocations}
    />
  )
}
