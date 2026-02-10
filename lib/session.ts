import type { Session } from "next-auth"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { cookies } from "next/headers"
import { prisma } from "@/lib/db"
import crypto from "node:crypto"
import { z } from "zod"

const E2E_COOKIE_NAME = "__e2e_session"

const e2eSessionSchema = z.object({
  orgId: z.string().min(1),
  role: z.string().min(1),
  user: z.object({
    id: z.string().min(1),
    name: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    image: z.string().nullable().optional(),
  }),
})

function allowE2E() {
  // Hard safety: never honor this cookie in production deployments.
  // In non-prod, only honor if an explicit secret is configured.
  return process.env.NODE_ENV !== "production" && Boolean(process.env.E2E_TEST_SECRET)
}

function timingSafeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a, "utf8")
  const bBuf = Buffer.from(b, "utf8")
  if (aBuf.length !== bBuf.length) return false
  return crypto.timingSafeEqual(aBuf, bBuf)
}

function signPayloadBase64Url(payloadB64Url: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(payloadB64Url).digest("base64url")
}

function verifyCookie(raw: string, secret: string): string | null {
  const [payloadB64Url, sigB64Url, ...rest] = raw.split(".")
  if (!payloadB64Url || !sigB64Url || rest.length > 0) return null
  const expectedSig = signPayloadBase64Url(payloadB64Url, secret)
  if (!timingSafeEqual(sigB64Url, expectedSig)) return null
  return payloadB64Url
}

async function tryGetE2ESession(): Promise<Session | null> {
  if (!allowE2E()) return null

  const cookieStore = await cookies()
  const raw = cookieStore.get(E2E_COOKIE_NAME)?.value
  if (!raw) return null

  try {
    const secret = process.env.E2E_TEST_SECRET
    if (!secret) return null

    const payloadB64Url = verifyCookie(raw, secret)
    if (!payloadB64Url) return null

    const jsonStr = Buffer.from(payloadB64Url, "base64url").toString("utf8")
    const parsed = e2eSessionSchema.safeParse(JSON.parse(jsonStr))
    if (!parsed.success) return null

    // NextAuth Session requires an expires field; keep it far enough in the future for tests.
    return {
      ...parsed.data,
      expires: new Date(Date.now() + 8 * 60 * 60_000).toISOString(),
    } as Session
  } catch {
    return null
  }
}

export async function getSession() {
  return (await tryGetE2ESession()) ?? getServerSession(authOptions())
}

export async function requireApiSession() {
  const session = await getSession()
  if (!session?.user?.id || !session.orgId) {
    return null
  }
  // Enforce org membership existence on every API request (org isolation).
  const membership = await prisma.membership.findUnique({
    where: { orgId_userId: { orgId: session.orgId, userId: session.user.id } },
    select: { orgId: true },
  })
  if (!membership) return null
  return session
}
