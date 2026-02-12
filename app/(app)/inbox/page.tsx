import { getSession } from "@/lib/session"
import { fetchInboxBootstrap } from "@/lib/reviews/bootstrap"
import { parseFilter, resolveRemoteFilter } from "./model"
import InboxClient from "./InboxClient"
import type { InboxBootstrap } from "./types"

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const session = await getSession()

  let ssrBootstrap: InboxBootstrap | null = null

  if (session?.orgId) {
    try {
      const rawFilter = typeof params.filter === "string" ? params.filter : null
      const rawTab = typeof params.tab === "string" ? params.tab : null
      const rawMention = typeof params.mention === "string" ? params.mention.trim().toLowerCase() : ""
      const rawLocationId = typeof params.locationId === "string" ? params.locationId.trim() : ""
      const rawRating = typeof params.rating === "string" ? params.rating : null

      const filter = parseFilter(rawFilter)
      const derivedTab = filter === "all" ? "all" : "pending"
      const tab =
        rawTab === "all" || rawTab === "pending" || rawTab === "replied" ? rawTab : derivedTab

      const effectiveFilter =
        filter === "mentions" && rawMention.length === 0 ? "all" : filter
      const remoteFilter = resolveRemoteFilter(effectiveFilter, tab)
      const remoteStatus =
        tab === "pending" ? "pending" : tab === "replied" ? "replied" : "all"
      const remoteMention =
        effectiveFilter === "mentions" ? rawMention || undefined : undefined

      const ratingNum = rawRating ? Number(rawRating) : undefined
      const validRating =
        ratingNum && Number.isFinite(ratingNum) && ratingNum >= 1 && ratingNum <= 5
          ? Math.floor(ratingNum)
          : undefined

      ssrBootstrap = await fetchInboxBootstrap({
        orgId: session.orgId,
        filter: remoteFilter,
        status: remoteStatus as "pending" | "replied" | "all",
        mention: remoteMention,
        locationId: rawLocationId || undefined,
        rating: validRating,
        includeCounts: true,
      })
    } catch {
      ssrBootstrap = null
    }
  }

  return <InboxClient ssrBootstrap={ssrBootstrap} />
}
