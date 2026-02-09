import { NextResponse } from "next/server"
import { z } from "zod"
import { requireApiSession } from "@/lib/session"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

const bodySchema = z.object({
  inviteId: z.string().min(1),
})

export async function POST(req: Request) {
  const session = await requireApiSession()
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })

  const actor = await prisma.membership.findUnique({
    where: { orgId_userId: { orgId: session.orgId, userId: session.user.id } },
    select: { role: true },
  })
  if (!actor || actor.role !== "OWNER") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
  }

  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "BAD_REQUEST", details: parsed.error.flatten() }, { status: 400 })
  }

  await prisma.invite.updateMany({
    where: { id: parsed.data.inviteId, orgId: session.orgId, usedAt: null },
    data: { expiresAt: new Date(0) },
  })

  return NextResponse.json({ ok: true })
}

