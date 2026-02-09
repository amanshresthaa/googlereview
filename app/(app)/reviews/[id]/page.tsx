import Link from "next/link"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import { extractMentionsAndHighlights } from "@/lib/reviews/mentions"
import { HighlightedText } from "@/components/HighlightedText"
import { ReviewDetailClient } from "@/app/(app)/reviews/[id]/ReviewDetailClient"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default async function ReviewDetailPage(ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.user?.id || !session.orgId) redirect("/signin")

  const { id } = await ctx.params
  const review = await prisma.review.findFirst({
    where: { id, orgId: session.orgId },
    include: {
      location: true,
      currentDraftReply: true,
      drafts: { orderBy: { version: "desc" }, take: 5 },
    },
  })
  if (!review) redirect("/inbox")

  const settings = await prisma.orgSettings.findUnique({ where: { orgId: session.orgId } })
  const mentionKeywords = settings?.mentionKeywords ?? []
  const { highlights } = extractMentionsAndHighlights(review.comment, mentionKeywords)

  const verifierSummary =
    review.currentDraftReply?.verifierResultJson
      ? JSON.stringify(review.currentDraftReply.verifierResultJson, null, 2)
      : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-muted-foreground text-xs">
            <Link href="/inbox" className="underline">
              Inbox
            </Link>{" "}
            / {review.location.displayName}
          </div>
          <h1 className="mt-1 text-lg font-semibold tracking-tight">
            {"★".repeat(review.starRating)}
            {"☆".repeat(Math.max(0, 5 - review.starRating))}{" "}
            <span className="text-muted-foreground font-normal">
              {review.reviewerDisplayName ?? "Guest"}
            </span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!review.googleReplyComment ? <Badge>Unanswered</Badge> : <Badge variant="secondary">Answered</Badge>}
          {review.mentions.length ? (
            <Badge variant="secondary">Mentions: {review.mentions.join(", ")}</Badge>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evidence</CardTitle>
          <CardDescription>AI is allowed to use only this review text.</CardDescription>
        </CardHeader>
        <CardContent>
          {review.comment ? (
            <HighlightedText text={review.comment} spans={highlights} />
          ) : (
            <p className="text-muted-foreground text-sm">(No written comment)</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Draft</CardTitle>
          <CardDescription>Generate, verify, approve, and publish a reply to Google.</CardDescription>
        </CardHeader>
        <CardContent>
          <ReviewDetailClient
            reviewId={review.id}
            hasReply={Boolean(review.googleReplyComment)}
            draftStatus={review.currentDraftReply?.status ?? null}
            draftText={review.currentDraftReply?.text ?? ""}
            verifierSummary={verifierSummary}
          />
        </CardContent>
      </Card>

      {review.drafts.length ? (
        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
            <CardDescription>Last {review.drafts.length} draft versions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {review.drafts.map((d) => (
              <div key={d.id} className="border-border/60 rounded-md border p-3">
                <div className="text-muted-foreground text-xs">
                  v{d.version} · {d.origin} · {d.status} · {d.createdAt.toISOString()}
                </div>
                <div className="mt-1 whitespace-pre-wrap text-sm">{d.text}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

