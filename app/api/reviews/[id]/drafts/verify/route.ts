import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { requireApiSession } from "@/lib/session"
import { prisma } from "@/lib/db"
import { enqueueJob } from "@/lib/jobs/queue"
import { runWorkerOnce } from "@/lib/jobs/worker"

export const runtime = "nodejs"

export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiSession()
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })

  const { id: reviewId } = await ctx.params
  const review = await prisma.review.findFirst({
    where: { id: reviewId, orgId: session.orgId, location: { enabled: true } },
    select: { currentDraftReplyId: true },
  })
  if (!review) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })
  if (!review.currentDraftReplyId) return NextResponse.json({ error: "NO_DRAFT" }, { status: 400 })

  const job = await enqueueJob({
    orgId: session.orgId,
    type: "VERIFY_DRAFT",
    payload: { draftReplyId: review.currentDraftReplyId },
  })
  const run = await runWorkerOnce({ limit: 3, workerId: crypto.randomUUID() })

  return NextResponse.json({ ok: true, jobId: job.id, worker: run })
}
