import { NextResponse } from "next/server"
import { z } from "zod"
import { requireApiSession } from "@/lib/session"
import { prisma } from "@/lib/db"
import { enqueueJob } from "@/lib/jobs/queue"
import { runWorkerOnce } from "@/lib/jobs/worker"
import crypto from "node:crypto"

export const runtime = "nodejs"

const bodySchema = z.object({
  enabledLocationIds: z.array(z.string().min(1)).max(200),
})

export async function POST(req: Request) {
  const session = await requireApiSession()
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })

  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "BAD_REQUEST", details: parsed.error.flatten() }, { status: 400 })
  }

  const enabledIds = parsed.data.enabledLocationIds

  await prisma.$transaction(async (tx) => {
    await tx.location.updateMany({
      where: { orgId: session.orgId, enabled: true, id: { notIn: enabledIds } },
      data: { enabled: false },
    })

    await tx.location.updateMany({
      where: { orgId: session.orgId, id: { in: enabledIds } },
      data: { enabled: true },
    })
  })

  // Enqueue review sync per enabled location (idempotent-ish).
  for (const locationId of enabledIds) {
    const existing = await prisma.job.findFirst({
      where: {
        orgId: session.orgId,
        type: "SYNC_REVIEWS",
        status: { in: ["PENDING", "RETRYING", "RUNNING"] },
        payload: { path: ["locationId"], equals: locationId },
      },
      select: { id: true },
    })
    if (existing) continue
    await enqueueJob({
      orgId: session.orgId,
      type: "SYNC_REVIEWS",
      payload: { locationId },
    })
  }

  const run = await runWorkerOnce({ limit: 5, workerId: crypto.randomUUID() })
  return NextResponse.json({ ok: true, worker: run })
}
