import Link from "next/link"
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

  const where: Prisma.ReviewWhereInput = { orgId: session.orgId }
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Inbox</h1>
          <p className="text-muted-foreground text-sm">
            Reviews synced from Google Business Profile. AI drafts require approval.
          </p>
        </div>
        <Link href="/onboarding/locations" className="text-sm underline">
          Manage locations
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/inbox?filter=unanswered"
          className={pillClass(filter === "unanswered")}
        >
          Unanswered
        </Link>
        <Link
          href="/inbox?filter=urgent"
          className={pillClass(filter === "urgent")}
        >
          1–2★ urgent
        </Link>
        <Link
          href="/inbox?filter=five_star"
          className={pillClass(filter === "five_star")}
        >
          5★
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground ms-1">Mentions:</span>
          {mentionKeywords.map((k) => (
            <Link
              key={k}
              href={`/inbox?filter=mentions&mention=${encodeURIComponent(k)}`}
              className={pillClass(filter === "mentions" && mention === k)}
            >
              {k}
            </Link>
          ))}
        </div>
      </div>

      <InboxClient
        allowBulk={allowBulk}
        rows={reviews.map((r) => ({
          id: r.id,
          starRating: r.starRating,
          snippet: (r.comment ?? "").slice(0, 140),
          locationName: r.location.displayName,
          createTimeIso: r.createTime.toISOString(),
          unanswered: !r.googleReplyComment,
          draftStatus: r.currentDraftReply?.status ?? null,
          mentions: r.mentions,
        }))}
      />
    </div>
  )
}

function pillClass(active: boolean) {
  return [
    "border-border rounded-full border px-3 py-1",
    active ? "bg-foreground text-background border-foreground" : "hover:bg-muted/50",
  ].join(" ")
}
