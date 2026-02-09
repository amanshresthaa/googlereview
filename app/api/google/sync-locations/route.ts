import { NextResponse } from "next/server"
import { requireApiSession } from "@/lib/session"
import { prisma } from "@/lib/db"
import { enqueueJob } from "@/lib/jobs/queue"
import { runWorkerOnce } from "@/lib/jobs/worker"
import crypto from "node:crypto"

export const runtime = "nodejs"

export async function POST() {
  const session = await requireApiSession()
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })

  const existing = await prisma.job.findFirst({
    where: {
      orgId: session.orgId,
      type: "SYNC_LOCATIONS",
      status: { in: ["PENDING", "RETRYING", "RUNNING"] },
    },
    select: { id: true },
  })

  const job =
    existing ??
    (await enqueueJob({ orgId: session.orgId, type: "SYNC_LOCATIONS", payload: {} }))
  const run = await runWorkerOnce({ limit: 3, workerId: crypto.randomUUID() })
  return NextResponse.json({ ok: true, jobId: job.id, worker: run })
}
