import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import { InboxClient } from "@/app/(app)/inbox/InboxClient"
import type { Prisma } from "@prisma/client"

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; mention?: string }>
}) {
  const session = await getSession()
  if (!session?.user?.id || !session.orgId) redirect("/signin")

  const sp = await searchParams
  const filter = sp.filter ?? "unanswered"
  const mention = sp.mention?.trim().toLowerCase()

  const settings = await prisma.orgSettings.findUnique({ where: { orgId: session.orgId } })
  const mentionKeywords = settings?.mentionKeywords ?? []
  const bulkEnabled = settings?.bulkApproveEnabledForFiveStar ?? true

  const where: Prisma.ReviewWhereInput = { orgId: session.orgId, location: { enabled: true } }
  if (filter === "unanswered") where.googleReplyComment = null
  if (filter === "urgent") {
    where.googleReplyComment = null
    where.starRating = { lte: 2 }
  }
  if (filter === "five_star") where.starRating = 5
  if (filter === "mentions") {
    if (mention) where.mentions = { has: mention }
  }

  const reviews = await prisma.review.findMany({
    where,
    include: { location: true, currentDraftReply: true },
    orderBy: [{ createTime: "desc" }],
    take: 50,
  })

  const allowBulk = filter === "five_star" && bulkEnabled

  return (
    <InboxClient
      filter={filter}
      mention={mention ?? null}
      mentionKeywords={mentionKeywords}
      allowBulk={allowBulk}
      rows={reviews.map((r) => ({
        id: r.id,
        starRating: r.starRating,
        snippet: (r.comment ?? "").slice(0, 120),
        locationName: r.location.displayName,
        createTimeIso: r.createTime.toISOString(),
        unanswered: !r.googleReplyComment,
        draftStatus: r.currentDraftReply?.status ?? null,
        mentions: r.mentions,
        reviewerName: null,
      }))}
    />
  )
}
