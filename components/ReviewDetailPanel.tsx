"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Star, ChevronDown, ChevronUp, ShieldCheck, AlertTriangle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DraftEditor } from "@/components/DraftEditor"
import type { ReviewDetail } from "@/lib/hooks"

type Props = {
  review: ReviewDetail
  onRefresh: () => void
  showBackLink?: boolean
}

const STARS = [1, 2, 3, 4, 5]

const MENTION_COLORS: Record<string, string> = {
  staff: "bg-blue-100 text-blue-800",
  food: "bg-orange-100 text-orange-800",
  cleanliness: "bg-teal-100 text-teal-800",
  service: "bg-purple-100 text-purple-800",
  price: "bg-yellow-100 text-yellow-800",
  location: "bg-pink-100 text-pink-800",
}

function getMentionColor(mention: string) {
  return MENTION_COLORS[mention.toLowerCase()] ?? "bg-stone-100 text-stone-700"
}

export function ReviewDetailPanel({ review, onRefresh, showBackLink }: Props) {
  const [historyOpen, setHistoryOpen] = React.useState(false)

  const reviewerName = review.reviewer.isAnonymous
    ? "Guest"
    : review.reviewer.displayName ?? "Guest"

  const initial = reviewerName[0]?.toUpperCase() ?? "?"

  const createdDate = new Date(review.createTime).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const previousDrafts = review.drafts.filter(
    (d) => d.id !== review.currentDraft?.id,
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      {showBackLink && (
        <Link
          href="/inbox"
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Inbox
        </Link>
      )}

      {/* Section 1: Review Header */}
      <Card className="border-stone-200">
        <CardContent>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-800 text-sm shrink-0">
              {initial}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-stone-900 truncate">
                {reviewerName}
              </div>
              <div className="flex gap-0.5">
                {STARS.map((s) => (
                  <Star
                    key={s}
                    size={14}
                    className={
                      s <= review.starRating
                        ? "fill-amber-400 text-amber-400"
                        : "text-stone-200"
                    }
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="text-xs text-stone-500 mb-1">
            {review.location.name}
          </div>
          <div className="text-xs text-stone-400">{createdDate}</div>
          {review.mentions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {review.mentions.map((m) => (
                <span
                  key={m}
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${getMentionColor(m)}`}
                >
                  {m}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Review Comment */}
      <Card className="border-stone-200">
        <CardContent>
          <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
            Review
          </h3>
          <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">
            {review.comment || "(No comment)"}
          </p>
        </CardContent>
      </Card>

      {/* Section 3: Draft Editor */}
      <Card className="border-stone-200">
        <CardContent>
          <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">
            Response
          </h3>
          <DraftEditor
            reviewId={review.id}
            draft={review.currentDraft}
            hasReply={review.reply.comment !== null}
            replyComment={review.reply.comment}
            replyUpdateTime={review.reply.updateTime}
            onRefresh={onRefresh}
          />
        </CardContent>
      </Card>

      {/* Section 4: Verifier Output */}
      {review.currentDraft?.verifierResultJson != null && (
        <VerifierCard
          status={review.currentDraft.status}
          resultJson={review.currentDraft.verifierResultJson}
        />
      )}

      {/* Section 5: Draft History */}
      {previousDrafts.length > 0 && (
        <Card className="border-stone-200">
          <CardContent>
            <button
              type="button"
              onClick={() => setHistoryOpen(!historyOpen)}
              className="flex items-center justify-between w-full text-left"
            >
              <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                Draft History ({previousDrafts.length})
              </h3>
              {historyOpen ? (
                <ChevronUp size={14} className="text-stone-400" />
              ) : (
                <ChevronDown size={14} className="text-stone-400" />
              )}
            </button>
            {historyOpen && (
              <div className="mt-3 space-y-3">
                {previousDrafts.map((d) => (
                  <div
                    key={d.id}
                    className="p-3 bg-stone-50 rounded-lg border border-stone-100"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-stone-600">
                        v{d.version}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        {d.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-stone-500 line-clamp-2">
                      {d.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function VerifierCard({
  status,
  resultJson,
}: {
  status: string
  resultJson: unknown
}) {
  if (status === "READY") {
    return (
      <Card className="border-green-200 bg-green-50/50">
        <CardContent>
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-green-600" />
            <div>
              <div className="text-sm font-semibold text-green-800">
                Verification passed
              </div>
              <p className="text-xs text-green-600">
                Draft aligns with business information and has no unsupported
                claims.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (status === "BLOCKED_BY_VERIFIER") {
    return (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent>
          <div className="flex gap-2">
            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-amber-800 mb-1">
                Verifier Warning
              </div>
              <pre className="text-xs text-amber-700 whitespace-pre-wrap break-words font-mono bg-amber-100/50 rounded p-2">
                {typeof resultJson === "string"
                  ? resultJson
                  : JSON.stringify(resultJson, null, 2)}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return null
}
