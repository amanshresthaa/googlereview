import { unstable_cache } from "next/cache"
import { prisma } from "@/lib/db"
import { getPerformanceSummary } from "@/lib/performance"

const SIDEBAR_CACHE_TTL_SEC = 15
const PERFORMANCE_CACHE_TTL_SEC = 30

function sidebarTag(orgId: string) {
  return `org:${orgId}:sidebar`
}

function forOrg<T>(orgId: string, scope: string, revalidate: number, fn: () => Promise<T>) {
  return unstable_cache(fn, [`sidebar:${scope}:${orgId}`], {
    revalidate,
    tags: [sidebarTag(orgId)],
  })()
}

export async function getInboxSidebarData(orgId: string) {
  return forOrg(orgId, "inbox", SIDEBAR_CACHE_TTL_SEC, async () => {
    const [settings, locations] = await Promise.all([
      prisma.orgSettings.findUnique({ where: { orgId } }),
      prisma.location.findMany({
        where: { orgId, enabled: true },
        orderBy: { displayName: "asc" },
        select: { id: true, displayName: true },
      }),
    ])
    return { settings, locations }
  })
}

export async function getLocationsSidebarData(orgId: string) {
  return forOrg(orgId, "locations", SIDEBAR_CACHE_TTL_SEC, async () =>
    prisma.location.findMany({
      where: { orgId },
      orderBy: { displayName: "asc" },
      select: {
        id: true,
        displayName: true,
        storeCode: true,
        addressSummary: true,
        enabled: true,
      },
    })
  )
}

export async function getSettingsSidebarData(orgId: string) {
  return forOrg(orgId, "settings", SIDEBAR_CACHE_TTL_SEC, async () => {
    const [org, settings, google] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
      prisma.orgSettings.findUnique({ where: { orgId } }),
      prisma.googleConnection.findUnique({
        where: { orgId },
        select: { status: true, googleEmail: true, scopes: true },
      }),
    ])
    return { org, settings, google }
  })
}

export async function getUsersSidebarData(orgId: string) {
  return forOrg(orgId, "users", SIDEBAR_CACHE_TTL_SEC, async () => {
    const now = new Date()
    const [memberships, invites] = await Promise.all([
      prisma.membership.findMany({
        where: { orgId },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.invite.findMany({
        where: { orgId, usedAt: null, expiresAt: { gt: now } },
        orderBy: { createdAt: "desc" },
        select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
      }),
    ])
    return { memberships, invites }
  })
}

export async function getPerformanceSidebarData(orgId: string) {
  return forOrg(orgId, "performance", PERFORMANCE_CACHE_TTL_SEC, async () => {
    const summary = await getPerformanceSummary({ orgId, days: 30 })
    const rangeStart = new Date(summary.range.startIso)
    const rangeEnd = new Date(summary.range.endIso)
    const aiDraftedInRange = await prisma.review.count({
      where: {
        orgId,
        location: { enabled: true },
        createTime: { gte: rangeStart, lte: rangeEnd },
        currentDraftReplyId: { not: null },
      },
    })
    return { summary, aiDraftedInRange }
  })
}

export function sidebarCacheTag(orgId: string) {
  return sidebarTag(orgId)
}
