import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { requireApiSession } from "@/lib/session"
import { enqueueJob } from "@/lib/jobs/queue"
import { runWorkerOnce } from "@/lib/jobs/worker"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiSession()
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })

  const { id: reviewId } = await ctx.params
  const exists = await prisma.review.findFirst({
    where: { id: reviewId, orgId: session.orgId, location: { enabled: true } },
    select: { id: true },
  })
  if (!exists) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })

  const job = await enqueueJob({
    orgId: session.orgId,
    type: "GENERATE_DRAFT",
    payload: { reviewId },
  })

  // Fast-path: run a small worker batch for interactive UX while keeping the job system canonical.
  const run = await runWorkerOnce({ limit: 3, workerId: crypto.randomUUID() })

  return NextResponse.json({ ok: true, jobId: job.id, worker: run })
}
