import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { InboxClient } from "@/app/(app)/inbox/InboxClient"
import { getInboxSidebarData } from "@/lib/sidebar-data"
import type { ReviewFilter } from "@/lib/hooks"

function parseFilter(input: string | undefined): ReviewFilter {
  const v = (input ?? "").toLowerCase()
  if (v === "unanswered" || v === "urgent" || v === "five_star" || v === "mentions" || v === "all") {
    return v
  }
  return "unanswered"
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; mention?: string }>
}) {
  const session = await getSession()
  if (!session?.user?.id || !session.orgId) redirect("/signin")

  const sp = await searchParams
  const { settings, locations } = await getInboxSidebarData(session.orgId)

  return (
    <InboxClient
      initialFilter={parseFilter(sp.filter)}
      initialMention={sp.mention ?? null}
      mentionKeywords={settings?.mentionKeywords ?? []}
      bulkApproveEnabled={settings?.bulkApproveEnabledForFiveStar ?? true}
      locations={locations}
    />
  )
}
