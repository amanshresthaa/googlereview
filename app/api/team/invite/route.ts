import { NextResponse } from "next/server"
import { z } from "zod"
import { requireApiSession } from "@/lib/session"
import { prisma } from "@/lib/db"
import { randomToken, sha256Hex } from "@/lib/crypto"

export const runtime = "nodejs"

const bodySchema = z.object({
  email: z.string().email(),
  role: z.enum(["OWNER", "MANAGER", "STAFF"]).default("STAFF"),
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

  const token = randomToken(32)
  const tokenHash = sha256Hex(token)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const invite = await prisma.invite.create({
    data: {
      orgId: session.orgId,
      email: parsed.data.email.toLowerCase(),
      role: parsed.data.role,
      tokenHash,
      expiresAt,
      createdByUserId: session.user.id,
    },
  })

  return NextResponse.json({
    ok: true,
    inviteId: invite.id,
    inviteUrl: `/invite/${token}`,
    expiresAt: invite.expiresAt.toISOString(),
  })
}
