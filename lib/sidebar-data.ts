import { unstable_cache } from "next/cache"
import { prisma } from "@/lib/db"

const SIDEBAR_CACHE_TTL_SEC = 15

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
    const [org, settings, google, locations] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
      prisma.orgSettings.findUnique({ where: { orgId } }),
      prisma.googleConnection.findUnique({
        where: { orgId },
        select: { status: true, googleEmail: true, scopes: true },
      }),
      prisma.location.findMany({
        where: { orgId, enabled: true },
        orderBy: { displayName: "asc" },
        select: {
          id: true,
          displayName: true,
          seoPrimaryKeywords: true,
          seoSecondaryKeywords: true,
          seoGeoTerms: true,
        },
      }),
    ])
    return { org, settings, google, locations }
  })
}

export function sidebarCacheTag(orgId: string) {
  return sidebarTag(orgId)
}
