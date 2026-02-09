import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { z } from "zod"
import { requireApiSession } from "@/lib/session"
import { prisma } from "@/lib/db"
import { enqueueJob } from "@/lib/jobs/queue"
import { runWorkerOnce } from "@/lib/jobs/worker"
import { extractMentionsAndHighlights } from "@/lib/reviews/mentions"

export const runtime = "nodejs"

const bodySchema = z.object({
  text: z.string().min(1).max(10_000),
})

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiSession()
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })

  const { id: reviewId } = await ctx.params
  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "BAD_REQUEST", details: parsed.error.flatten() }, { status: 400 })
  }

  const review = await prisma.review.findFirst({
    where: { id: reviewId, orgId: session.orgId },
    include: { currentDraftReply: true, location: true },
  })
  if (!review) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })

  const maxVersion = await prisma.draftReply.aggregate({
    where: { reviewId: review.id },
    _max: { version: true },
  })
  const nextVersion = (maxVersion._max.version ?? 0) + 1
  const settings = await prisma.orgSettings.findUnique({ where: { orgId: session.orgId } })
  const mentionKeywords = settings?.mentionKeywords ?? []
  const { highlights, mentions } = extractMentionsAndHighlights(review.comment, mentionKeywords)
  await prisma.review.update({
    where: { id: review.id },
    data: { mentions },
  })

  const evidence = {
    starRating: review.starRating,
    comment: review.comment ?? null,
    reviewerDisplayName: review.reviewerDisplayName ?? null,
    reviewerIsAnonymous: review.reviewerIsAnonymous,
    locationDisplayName: review.location.displayName,
    createTime: review.createTime.toISOString(),
    highlights,
    mentionKeywords,
    tone: {
      preset: settings?.tonePreset ?? "friendly",
      customInstructions: settings?.toneCustomInstructions ?? null,
    },
  }

  const created = await prisma.draftReply.create({
    data: {
      orgId: session.orgId,
      reviewId: review.id,
      version: nextVersion,
      text: parsed.data.text,
      origin: "USER_EDITED",
      status: "NEEDS_APPROVAL",
      evidenceSnapshotJson: evidence as never,
    },
  })
  await prisma.review.update({
    where: { id: review.id },
    data: { currentDraftReplyId: created.id },
  })

  const verifyJob = await enqueueJob({
    orgId: session.orgId,
    type: "VERIFY_DRAFT",
    payload: { draftReplyId: created.id },
  })
  const run = await runWorkerOnce({ limit: 3, workerId: crypto.randomUUID() })

  return NextResponse.json({ ok: true, draftReplyId: created.id, verifyJobId: verifyJob.id, worker: run })
}
