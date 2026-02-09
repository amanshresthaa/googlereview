import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import { extractMentionsAndHighlights } from "@/lib/reviews/mentions"
import { HighlightedText } from "@/components/HighlightedText"
import { ReviewDetailClient } from "@/app/(app)/reviews/[id]/ReviewDetailClient"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default async function ReviewDetailPage(ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.user?.id || !session.orgId) redirect("/signin")

  const { id } = await ctx.params
  const review = await prisma.review.findFirst({
    where: { id, orgId: session.orgId, location: { enabled: true } },
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
    <div className="mx-auto max-w-3xl space-y-6 p-6 animate-fade-in">
      <Link
        href="/inbox"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        Back to inbox
      </Link>

      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{"★".repeat(review.starRating)}</span>
            <span className="text-muted-foreground text-sm">
              {review.reviewerDisplayName ?? "Guest"}
            </span>
          </div>
          <p className="text-muted-foreground text-xs mt-0.5">
            {review.location.displayName} · {review.createTime.toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!review.googleReplyComment ? (
            <Badge variant="outline">Unanswered</Badge>
          ) : (
            <Badge variant="secondary">Answered</Badge>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Review</CardTitle>
        </CardHeader>
        <CardContent>
          {review.comment ? (
            <HighlightedText text={review.comment} spans={highlights} />
          ) : (
            <p className="text-muted-foreground text-sm">(Rating only — no written comment)</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Reply</CardTitle>
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

      {review.drafts.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Draft history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {review.drafts.map((d) => (
              <div key={d.id} className="rounded-md border border-border p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>v{d.version}</span>
                  <span>·</span>
                  <span>{d.origin}</span>
                  <span>·</span>
                  <Badge variant="secondary" className="text-[10px]">{d.status}</Badge>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm">{d.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
