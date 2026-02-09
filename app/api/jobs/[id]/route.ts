import { NextResponse } from "next/server"
import { z } from "zod"
import { requireApiSession } from "@/lib/session"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

const paramsSchema = z.object({ id: z.string().min(1) })

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiSession()
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })

  const raw = await ctx.params
  const parsed = paramsSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "BAD_REQUEST", details: parsed.error.flatten() }, { status: 400 })
  }

  const job = await prisma.job.findFirst({
    where: { id: parsed.data.id, orgId: session.orgId },
    select: {
      id: true,
      type: true,
      status: true,
      attempts: true,
      maxAttempts: true,
      runAt: true,
      lockedAt: true,
      completedAt: true,
      lastError: true,
    },
  })

  if (!job) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })

  return NextResponse.json({
    job: {
      id: job.id,
      type: job.type,
      status: job.status,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      runAtIso: job.runAt.toISOString(),
      lockedAtIso: job.lockedAt?.toISOString() ?? null,
      completedAtIso: job.completedAt?.toISOString() ?? null,
      lastError: job.lastError ?? null,
    },
  })
}

