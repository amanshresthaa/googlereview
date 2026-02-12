import type { Session } from "next-auth"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { cookies } from "next/headers"
import { prisma } from "@/lib/db"
import crypto from "node:crypto"
import { z } from "zod"

const E2E_COOKIE_NAME = "__e2e_session"
export const MEMBERSHIP_GRANT_COOKIE_NAME = "__membership_grant"
const MEMBERSHIP_CACHE_TTL_MS = 60_000
const MEMBERSHIP_CACHE_MAX_ENTRIES = 2048
const MEMBERSHIP_GRANT_TTL_SEC = 180

type MembershipCacheEntry = {
  expiresAt: number
}

type MembershipLookupTiming = {
  cacheHit: boolean
  inflightHit: boolean
  grantHit: boolean
  membershipMs: number
}

type MembershipLookupResult = MembershipLookupTiming & {
  exists: boolean
  issuedGrantValue: string | null
}

export type ApiSessionTiming = MembershipLookupTiming & {
  getSessionMs: number
  totalAuthMs: number
}

const membershipExistsCache = new Map<string, MembershipCacheEntry>()
const membershipInflight = new Map<string, Promise<boolean>>()

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

function membershipCacheKey(orgId: string, userId: string) {
  return `${orgId}:${userId}`
}

type MembershipGrantPayload = {
  orgId: string
  userId: string
  exp: number
}

function nowEpochSec() {
  return Math.floor(Date.now() / 1000)
}

function membershipGrantSecret() {
  return process.env.NEXTAUTH_SECRET ?? null
}

function signMembershipGrantPayload(payloadB64Url: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(payloadB64Url).digest("base64url")
}

function parseMembershipGrant(raw: string, secret: string): MembershipGrantPayload | null {
  const [payloadB64Url, sigB64Url, ...rest] = raw.split(".")
  if (!payloadB64Url || !sigB64Url || rest.length > 0) return null
  const expectedSig = signMembershipGrantPayload(payloadB64Url, secret)
  if (!timingSafeEqual(sigB64Url, expectedSig)) return null

  try {
    const jsonStr = Buffer.from(payloadB64Url, "base64url").toString("utf8")
    const parsed = JSON.parse(jsonStr) as MembershipGrantPayload
    if (!parsed?.orgId || !parsed?.userId || !Number.isFinite(parsed?.exp)) return null
    return parsed
  } catch {
    return null
  }
}

function buildMembershipGrant(orgId: string, userId: string, secret: string): string {
  const payload: MembershipGrantPayload = {
    orgId,
    userId,
    exp: nowEpochSec() + MEMBERSHIP_GRANT_TTL_SEC,
  }
  const payloadB64Url = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  const sigB64Url = signMembershipGrantPayload(payloadB64Url, secret)
  return `${payloadB64Url}.${sigB64Url}`
}

async function hasValidMembershipGrant(orgId: string, userId: string): Promise<boolean> {
  const secret = membershipGrantSecret()
  if (!secret) return false
  const cookieStore = await cookies()
  const raw = cookieStore.get(MEMBERSHIP_GRANT_COOKIE_NAME)?.value
  if (!raw) return false
  const parsed = parseMembershipGrant(raw, secret)
  if (!parsed) return false
  if (parsed.exp < nowEpochSec()) return false
  return parsed.orgId === orgId && parsed.userId === userId
}

function hasCachedMembership(key: string): boolean {
  const cached = membershipExistsCache.get(key)
  if (!cached) return false
  if (cached.expiresAt <= Date.now()) {
    membershipExistsCache.delete(key)
    return false
  }
  // Promote as most recently used and extend TTL while actively used.
  membershipExistsCache.delete(key)
  membershipExistsCache.set(key, { expiresAt: Date.now() + MEMBERSHIP_CACHE_TTL_MS })
  return true
}

function cacheMembershipExists(key: string): void {
  membershipExistsCache.set(key, { expiresAt: Date.now() + MEMBERSHIP_CACHE_TTL_MS })
  if (membershipExistsCache.size <= MEMBERSHIP_CACHE_MAX_ENTRIES) return
  const oldest = membershipExistsCache.keys().next()
  if (!oldest.done) {
    membershipExistsCache.delete(oldest.value)
  }
}

async function membershipExistsWithTiming(orgId: string, userId: string): Promise<MembershipLookupResult> {
  const startedAt = Date.now()
  const key = membershipCacheKey(orgId, userId)
  if (hasCachedMembership(key)) {
    return {
      exists: true,
      cacheHit: true,
      inflightHit: false,
      grantHit: false,
      membershipMs: Date.now() - startedAt,
      issuedGrantValue: null,
    }
  }

  if (await hasValidMembershipGrant(orgId, userId)) {
    cacheMembershipExists(key)
    return {
      exists: true,
      cacheHit: false,
      inflightHit: false,
      grantHit: true,
      membershipMs: Date.now() - startedAt,
      issuedGrantValue: null,
    }
  }

  const inflight = membershipInflight.get(key)
  if (inflight) {
    const exists = await inflight
    return {
      exists,
      cacheHit: false,
      inflightHit: true,
      grantHit: false,
      membershipMs: Date.now() - startedAt,
      issuedGrantValue: null,
    }
  }

  const lookup = prisma.membership
    .findUnique({
      where: { orgId_userId: { orgId, userId } },
      select: { orgId: true },
    })
    .then((membership) => {
      const exists = Boolean(membership)
      // Cache only positive membership to keep revocation lag bounded.
      if (exists) {
        cacheMembershipExists(key)
      }
      return exists
    })
    .finally(() => {
      membershipInflight.delete(key)
    })

  membershipInflight.set(key, lookup)
  const exists = await lookup
  const secret = membershipGrantSecret()
  return {
    exists,
    cacheHit: false,
    inflightHit: false,
    grantHit: false,
    membershipMs: Date.now() - startedAt,
    issuedGrantValue: exists && secret ? buildMembershipGrant(orgId, userId, secret) : null,
  }
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

export async function requireApiSessionWithTiming(): Promise<{
  session: Session | null
  timing: ApiSessionTiming
  membershipGrantValue: string | null
}> {
  const authStartedAt = Date.now()
  const sessionStartedAt = Date.now()
  const session = await getSession()
  const getSessionMs = Date.now() - sessionStartedAt
  if (!session?.user?.id || !session.orgId) {
    return {
      session: null,
      timing: {
        getSessionMs,
        membershipMs: 0,
        cacheHit: false,
        inflightHit: false,
        grantHit: false,
        totalAuthMs: Date.now() - authStartedAt,
      },
      membershipGrantValue: null,
    }
  }

  // Enforce org membership existence on every API request (org isolation).
  const membership = await membershipExistsWithTiming(session.orgId, session.user.id)
  if (!membership.exists) {
    return {
      session: null,
      timing: {
        getSessionMs,
        membershipMs: membership.membershipMs,
        cacheHit: membership.cacheHit,
        inflightHit: membership.inflightHit,
        grantHit: membership.grantHit,
        totalAuthMs: Date.now() - authStartedAt,
      },
      membershipGrantValue: null,
    }
  }

  return {
    session,
    timing: {
      getSessionMs,
      membershipMs: membership.membershipMs,
      cacheHit: membership.cacheHit,
      inflightHit: membership.inflightHit,
      grantHit: membership.grantHit,
      totalAuthMs: Date.now() - authStartedAt,
    },
    membershipGrantValue: membership.issuedGrantValue,
  }
}

export async function requireApiSession() {
  const { session } = await requireApiSessionWithTiming()
  return session
}
