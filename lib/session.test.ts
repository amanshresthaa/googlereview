import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import crypto from "node:crypto"

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  cookies: vi.fn(),
  membershipFindUnique: vi.fn(),
}))

vi.mock("next-auth", () => ({
  getServerSession: mocks.getServerSession,
}))

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}))

vi.mock("@/lib/auth-options", () => ({
  authOptions: () => ({}),
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: {
      findUnique: mocks.membershipFindUnique,
    },
  },
}))

import {
  MEMBERSHIP_CACHE_TTL_MS,
  MEMBERSHIP_GRANT_COOKIE_NAME,
  invalidateAllMembershipAuthCache,
  invalidateMembershipAuthCache,
  requireApiSessionWithTiming,
} from "@/lib/session"

function makeCookieStore(grant: string | null) {
  return {
    get(name: string) {
      if (name !== MEMBERSHIP_GRANT_COOKIE_NAME || !grant) return undefined
      return { value: grant }
    },
  }
}

function buildGrant(input: { orgId: string; userId: string; role: string; iatMs: number; exp: number }, secret: string) {
  const payload = Buffer.from(JSON.stringify(input), "utf8").toString("base64url")
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url")
  return `${payload}.${sig}`
}

beforeEach(() => {
  invalidateAllMembershipAuthCache()
  delete process.env.E2E_TEST_SECRET
  delete process.env.NEXTAUTH_SECRET
  mocks.getServerSession.mockReset()
  mocks.cookies.mockReset()
  mocks.membershipFindUnique.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("session membership auth cache", () => {
  it("keeps a fixed cache expiry and refreshes session role from membership state", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-02-15T00:00:00.000Z"))
    process.env.NEXTAUTH_SECRET = "test-secret"

    mocks.getServerSession.mockResolvedValue({
      user: { id: "user-1" },
      orgId: "org-1",
      role: "OWNER",
      expires: "2099-01-01T00:00:00.000Z",
    })
    mocks.cookies.mockResolvedValue(makeCookieStore(null))
    mocks.membershipFindUnique.mockResolvedValue({ role: "MANAGER" })

    const first = await requireApiSessionWithTiming()
    expect(first.session?.role).toBe("MANAGER")
    expect(first.timing.cacheHit).toBe(false)
    expect(mocks.membershipFindUnique).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(MEMBERSHIP_CACHE_TTL_MS - 1)
    const second = await requireApiSessionWithTiming()
    expect(second.session?.role).toBe("MANAGER")
    expect(second.timing.cacheHit).toBe(true)
    expect(mocks.membershipFindUnique).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(2)
    const third = await requireApiSessionWithTiming()
    expect(third.session?.role).toBe("MANAGER")
    expect(third.timing.cacheHit).toBe(false)
    expect(mocks.membershipFindUnique).toHaveBeenCalledTimes(2)
  })

  it("rejects previously issued grants after explicit invalidation", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-02-15T00:00:00.000Z"))
    process.env.NEXTAUTH_SECRET = "test-secret"

    mocks.getServerSession.mockResolvedValue({
      user: { id: "user-1" },
      orgId: "org-1",
      role: "OWNER",
      expires: "2099-01-01T00:00:00.000Z",
    })
    mocks.membershipFindUnique.mockResolvedValue(null)

    const nowMs = Date.now()
    const nowSec = Math.floor(nowMs / 1000)
    const grant = buildGrant(
      {
        orgId: "org-1",
        userId: "user-1",
        role: "OWNER",
        iatMs: nowMs,
        exp: nowSec + 180,
      },
      process.env.NEXTAUTH_SECRET,
    )
    mocks.cookies.mockResolvedValue(makeCookieStore(grant))

    const granted = await requireApiSessionWithTiming()
    expect(granted.session?.role).toBe("OWNER")
    expect(granted.timing.grantHit).toBe(true)
    expect(mocks.membershipFindUnique).toHaveBeenCalledTimes(0)

    invalidateMembershipAuthCache("org-1", "user-1")

    const revoked = await requireApiSessionWithTiming()
    expect(revoked.session).toBeNull()
    expect(revoked.timing.grantHit).toBe(false)
    expect(mocks.membershipFindUnique).toHaveBeenCalledTimes(1)
  })
})
