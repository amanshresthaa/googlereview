import type { Session } from "next-auth"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { cookies } from "next/headers"
import { prisma } from "@/lib/db"
import crypto from "node:crypto"
import { z } from "zod"

const E2E_COOKIE_NAME = "__e2e_session"
export const MEMBERSHIP_GRANT_COOKIE_NAME = "__membership_grant"
export const MEMBERSHIP_CACHE_TTL_MS = 60_000
const MEMBERSHIP_CACHE_MAX_ENTRIES = 2048
export const MEMBERSHIP_GRANT_TTL_SEC = 180

type MembershipCacheEntry = {
  expiresAt: number
  role: string
}

type MembershipGrantInvalidationEntry = {
  invalidAfterMs: number
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
  role: string | null
  issuedGrantValue: string | null
}

export type ApiSessionTiming = MembershipLookupTiming & {
  getSessionMs: number
  totalAuthMs: number
}

const membershipExistsCache = new Map<string, MembershipCacheEntry>()
const membershipInflight = new Map<string, Promise<string | null>>()
const membershipGrantInvalidations = new Map<string, MembershipGrantInvalidationEntry>()

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
  role: string
  iatMs: number
  exp: number
}

function nowEpochSec() {
  return Math.floor(Date.now() / 1000)
}

function trimOldestEntry<K, V>(map: Map<K, V>, maxEntries: number) {
  if (map.size <= maxEntries) return
  const oldest = map.keys().next()
  if (!oldest.done) {
    map.delete(oldest.value)
  }
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
    if (!parsed?.orgId || !parsed?.userId || !parsed?.role) return null
    if (!Number.isFinite(parsed?.iatMs) || !Number.isFinite(parsed?.exp)) return null
    return parsed
  } catch {
    return null
  }
}

function buildMembershipGrant(orgId: string, userId: string, role: string, secret: string): string {
  const payload: MembershipGrantPayload = {
    orgId,
    userId,
    role,
    iatMs: Date.now(),
    exp: nowEpochSec() + MEMBERSHIP_GRANT_TTL_SEC,
  }
  const payloadB64Url = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  const sigB64Url = signMembershipGrantPayload(payloadB64Url, secret)
  return `${payloadB64Url}.${sigB64Url}`
}

function shouldRejectGrantByInvalidation(key: string, grantIatMs: number): boolean {
  const invalidation = membershipGrantInvalidations.get(key)
  if (!invalidation) return false
  if (invalidation.expiresAt <= Date.now()) {
    membershipGrantInvalidations.delete(key)
    return false
  }
  return grantIatMs <= invalidation.invalidAfterMs
}

async function getValidMembershipGrant(orgId: string, userId: string): Promise<MembershipGrantPayload | null> {
  const secret = membershipGrantSecret()
  if (!secret) return null
  const cookieStore = await cookies()
  const raw = cookieStore.get(MEMBERSHIP_GRANT_COOKIE_NAME)?.value
  if (!raw) return null
  const parsed = parseMembershipGrant(raw, secret)
  if (!parsed) return null
  if (parsed.exp <= nowEpochSec()) return null
  if (parsed.orgId !== orgId || parsed.userId !== userId) return null
  const key = membershipCacheKey(orgId, userId)
  if (shouldRejectGrantByInvalidation(key, parsed.iatMs)) return null
  return parsed
}

function getCachedMembershipRole(key: string): string | null {
  const cached = membershipExistsCache.get(key)
  if (!cached) return null
  if (cached.expiresAt <= Date.now()) {
    membershipExistsCache.delete(key)
    return null
  }
  // Promote as most recently used without extending original expiry.
  membershipExistsCache.delete(key)
  membershipExistsCache.set(key, cached)
  return cached.role
}

function cacheMembershipExists(key: string, role: string, expiresAt = Date.now() + MEMBERSHIP_CACHE_TTL_MS): void {
  if (expiresAt <= Date.now()) return
  membershipExistsCache.set(key, { expiresAt, role })
  trimOldestEntry(membershipExistsCache, MEMBERSHIP_CACHE_MAX_ENTRIES)
}

export function invalidateMembershipAuthCache(orgId: string, userId: string): void {
  const key = membershipCacheKey(orgId, userId)
  membershipExistsCache.delete(key)
  membershipInflight.delete(key)
  membershipGrantInvalidations.set(key, {
    invalidAfterMs: Date.now(),
    expiresAt: Date.now() + MEMBERSHIP_GRANT_TTL_SEC * 1000,
  })
  trimOldestEntry(membershipGrantInvalidations, MEMBERSHIP_CACHE_MAX_ENTRIES)
}

export function invalidateAllMembershipAuthCache(): void {
  membershipExistsCache.clear()
  membershipInflight.clear()
  membershipGrantInvalidations.clear()
}

async function membershipExistsWithTiming(orgId: string, userId: string): Promise<MembershipLookupResult> {
  const startedAt = Date.now()
  const key = membershipCacheKey(orgId, userId)
  const cachedRole = getCachedMembershipRole(key)
  if (cachedRole) {
    return {
      exists: true,
      role: cachedRole,
      cacheHit: true,
      inflightHit: false,
      grantHit: false,
      membershipMs: Date.now() - startedAt,
      issuedGrantValue: null,
    }
  }

  const grant = await getValidMembershipGrant(orgId, userId)
  if (grant) {
    cacheMembershipExists(
      key,
      grant.role,
      Math.min(Date.now() + MEMBERSHIP_CACHE_TTL_MS, grant.exp * 1000),
    )
    return {
      exists: true,
      role: grant.role,
      cacheHit: false,
      inflightHit: false,
      grantHit: true,
      membershipMs: Date.now() - startedAt,
      issuedGrantValue: null,
    }
  }

  const inflight = membershipInflight.get(key)
  if (inflight) {
    const role = await inflight
    return {
      exists: Boolean(role),
      role,
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
      select: { role: true },
    })
    .then((membership) => {
      const role = membership?.role ?? null
      // Cache only positive membership to keep revocation lag bounded.
      if (role) {
        cacheMembershipExists(key, role)
      }
      return role
    })
    .finally(() => {
      membershipInflight.delete(key)
    })

  membershipInflight.set(key, lookup)
  const role = await lookup
  const secret = membershipGrantSecret()
  return {
    exists: Boolean(role),
    role,
    cacheHit: false,
    inflightHit: false,
    grantHit: false,
    membershipMs: Date.now() - startedAt,
    issuedGrantValue: role && secret ? buildMembershipGrant(orgId, userId, role, secret) : null,
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
  if (!membership.exists || !membership.role) {
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

  const sessionWithRole =
    session.role === membership.role
      ? session
      : ({
          ...session,
          role: membership.role,
        } satisfies Session)

  return {
    session: sessionWithRole,
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
