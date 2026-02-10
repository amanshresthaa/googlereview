import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import { InboxClient } from "@/app/(app)/inbox/InboxClient"

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; mention?: string }>
}) {
  const session = await getSession()
  if (!session?.user?.id || !session.orgId) redirect("/signin")

  const sp = await searchParams
  const settings = await prisma.orgSettings.findUnique({ where: { orgId: session.orgId } })

  return (
    <InboxClient
      initialFilter={(sp.filter as "unanswered" | "urgent" | "five_star" | "mentions" | "all") ?? "unanswered"}
      initialMention={sp.mention ?? null}
      mentionKeywords={settings?.mentionKeywords ?? []}
      bulkApproveEnabled={settings?.bulkApproveEnabledForFiveStar ?? true}
    />
  )
}
