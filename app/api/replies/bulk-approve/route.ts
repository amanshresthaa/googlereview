import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { z } from "zod"
import { requireApiSession } from "@/lib/session"
import { prisma } from "@/lib/db"
import { enqueueJob } from "@/lib/jobs/queue"
import { runWorkerOnce } from "@/lib/jobs/worker"

export const runtime = "nodejs"

const bodySchema = z.object({
  reviewIds: z.array(z.string().min(1)).min(1).max(50),
})

export async function POST(req: Request) {
  const session = await requireApiSession()
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })

  const settings = await prisma.orgSettings.findUnique({ where: { orgId: session.orgId } })
  if (settings?.bulkApproveEnabledForFiveStar === false) {
    return NextResponse.json({ error: "BULK_APPROVE_DISABLED" }, { status: 403 })
  }

  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "BAD_REQUEST", details: parsed.error.flatten() }, { status: 400 })
  }

  const reviews = await prisma.review.findMany({
    where: {
      orgId: session.orgId,
      id: { in: parsed.data.reviewIds },
      location: { enabled: true },
      starRating: 5,
      googleReplyComment: null,
    },
    include: { currentDraftReply: true },
  })

  const invalid = reviews.filter((r) => r.currentDraftReply?.status !== "READY")
  if (invalid.length) {
    return NextResponse.json(
      { error: "INVALID_REVIEWS", details: { notReady: invalid.map((r) => r.id) } },
      { status: 400 }
    )
  }

  const jobs: string[] = []
  for (const r of reviews) {
    if (!r.currentDraftReplyId) continue
    const job = await enqueueJob({
      orgId: session.orgId,
      type: "POST_REPLY",
      payload: { draftReplyId: r.currentDraftReplyId, actorUserId: session.user.id },
    })
    jobs.push(job.id)
  }

  const run = await runWorkerOnce({ limit: 10, workerId: crypto.randomUUID() })
  return NextResponse.json({ ok: true, jobIds: jobs, worker: run })
}
