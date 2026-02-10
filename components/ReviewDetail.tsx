"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { useReviewDetail, formatAge } from "@/lib/hooks"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { DraftEditor } from "@/components/DraftEditor"
import {
  Star,
  MapPin,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  History,
  ThumbsUp,
  ThumbsDown,
  CheckCircle2,
} from "@/components/icons"

function initials(name: string | null | undefined) {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  const a = parts[0]?.[0] ?? "?"
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : ""
  return (a + b).toUpperCase()
}

function StarsRow({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${value} stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          weight={i < value ? "fill" : "regular"}
          className={cn(
            "h-4 w-4",
            i < value ? "fill-primary text-primary" : "text-muted-foreground/40"
          )}
        />
      ))}
    </div>
  )
}

function ratingAvatarClasses(stars: number) {
  if (stars >= 4) return "bg-primary/10 text-primary"
  if (stars === 3) return "bg-amber-50 text-amber-600"
  return "bg-rose-50 text-rose-600"
}

function sentimentLabel(stars: number) {
  if (stars >= 4) return { label: "Positive", icon: ThumbsUp, color: "text-emerald-600", bg: "bg-emerald-500", barBg: "bg-emerald-100" }
  if (stars === 3) return { label: "Neutral", icon: ThumbsUp, color: "text-amber-600", bg: "bg-amber-500", barBg: "bg-amber-100" }
  return { label: "Negative", icon: ThumbsDown, color: "text-rose-600", bg: "bg-rose-500", barBg: "bg-rose-100" }
}

export function ReviewDetail({ reviewId }: { reviewId: string }) {
  const { review, loading, error, refresh } = useReviewDetail(reviewId)
  const focusId = React.useId()

  if (loading && !review) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="h-24 w-24 bg-card shadow-sm rounded-3xl flex items-center justify-center mb-6 border border-border">
          <AlertTriangle className="h-10 w-10 text-muted-foreground/60" />
        </div>
        <p className="text-sm font-medium text-foreground">Unable to load review</p>
        <p className="text-xs text-muted-foreground mt-1.5">{error}</p>
      </div>
    )
  }

  if (!review) return null

  const sentiment = sentimentLabel(review.starRating)
  const isPositive = review.starRating >= 4
  const hasVerifier = review.currentDraft?.verifierResultJson != null
  const verifierPassed = review.currentDraft?.status !== "BLOCKED_BY_VERIFIER"

  return (
    <div className="h-full flex flex-col">
      {/* Detail Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur-sm px-6 py-4 flex items-center justify-between shrink-0 sticky top-0 z-10 rounded-t-2xl">
        <div className="flex items-center gap-4">
          <Avatar className="h-10 w-10 border border-border shadow-sm">
            <AvatarFallback className={cn("font-semibold", ratingAvatarClasses(review.starRating))}>
              {initials(review.reviewer.displayName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="text-sm font-bold text-foreground">
              {review.reviewer.displayName ?? "Anonymous"}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <MapPin className="h-3 w-3" /> {review.location.name}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{formatAge(review.createTime)}</span>
            <div className="flex items-center gap-1 text-primary mt-0.5">
              <span className="font-bold text-sm text-foreground">{review.starRating}.0</span>
              <Star className="h-3.5 w-3.5 fill-current" weight="fill" />
            </div>
          </div>
          <Separator orientation="vertical" className="h-8" />
          <Badge
            variant="secondary"
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium",
              !review.reply.comment && review.currentDraft?.status === "READY"
                ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-card"
                : review.currentDraft?.status === "BLOCKED_BY_VERIFIER"
                  ? "bg-rose-100 text-rose-700"
                  : review.reply.comment
                    ? "bg-emerald-100 text-emerald-700"
                    : undefined
            )}
          >
            {review.reply.comment ? "Replied" : review.currentDraft?.status === "READY" ? "Draft ready" : review.currentDraft?.status === "BLOCKED_BY_VERIFIER" ? "Flagged" : "Needs reply"}
          </Badge>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left Context Rail — hidden on smaller screens */}
        <div className="w-72 border-r border-border bg-card overflow-y-auto p-6 hidden xl:block scrollbar-thin">
          <div className="space-y-8">
            {/* Sentiment Card */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <Sparkles className="h-3 w-3" /> Analysis
              </h3>
              <Card className="shadow-card border-border overflow-hidden rounded-2xl">
                <div className={cn("h-1.5 w-full", isPositive ? "bg-emerald-500" : "bg-rose-500")} />
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <sentiment.icon className={cn("h-4 w-4", sentiment.color)} />
                    <span className="font-semibold text-sm capitalize text-foreground">{sentiment.label} Sentiment</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {isPositive
                      ? "Review highlights excellent service and satisfaction."
                      : "Review indicates areas for improvement."
                    }
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Verification Status */}
            {hasVerifier && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <ShieldCheck className="h-3 w-3" /> Verification
                </h3>
                <Card className="shadow-card border-border rounded-2xl">
                  <CardContent className="p-5">
                    {verifierPassed ? (
                      <div className="flex items-center gap-2 text-emerald-700">
                        <div className="p-1.5 bg-emerald-100 rounded-lg">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold">Safe to publish</div>
                          <div className="text-xs text-emerald-600 mt-0.5">Verified against profile data</div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-rose-700">
                        <div className="p-1.5 bg-rose-100 rounded-lg">
                          <AlertTriangle className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold">Review required</div>
                          <div className="text-xs text-rose-600 mt-0.5">Potential accuracy issue detected</div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Draft History */}
            {review.drafts.length > 1 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <History className="h-3 w-3" /> Draft History
                </h3>
                <div className="space-y-2">
                  {review.drafts.slice(0, 5).map((d) => (
                    <Card key={d.id} className="shadow-card border-border rounded-xl">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <Badge variant="secondary" className="rounded-md text-[9px] h-4 px-1.5 font-bold">v{d.version}</Badge>
                          <span className="text-[9px] text-muted-foreground uppercase font-semibold">{d.status}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">{d.text}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-background/60">
          <ScrollArea className="flex-1 scrollbar-thin">
            <div className="p-8 max-w-3xl mx-auto space-y-8">
              {/* Original Review Bubble */}
              <div className="flex gap-5">
                <Avatar className="h-9 w-9 mt-1 border border-border shrink-0">
                  <AvatarFallback className="text-xs bg-card text-muted-foreground">
                    {initials(review.reviewer.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2 max-w-[85%]">
                  <div className="text-xs font-medium text-muted-foreground ml-1 uppercase tracking-wide">
                    {review.reviewer.displayName ?? "Anonymous"}
                  </div>
                  <div className="bg-card p-6 rounded-3xl rounded-tl-none text-base leading-relaxed text-foreground border border-border shadow-card">
                    {review.comment ?? <span className="text-muted-foreground italic">No comment provided</span>}
                  </div>
                  <div className="ml-1 flex items-center gap-3">
                    <StarsRow value={review.starRating} />
                    <span className="text-[10px] text-muted-foreground">{formatAge(review.createTime)}</span>
                  </div>
                </div>
              </div>

              {/* Published Reply */}
              {review.reply.comment && (
                <div className="flex gap-5 justify-end">
                  <div className="space-y-2 max-w-[85%]">
                    <div className="text-xs font-medium text-muted-foreground mr-1 uppercase tracking-wide text-right">Your reply</div>
                    <div className="bg-emerald-50 p-6 rounded-3xl rounded-tr-none text-base leading-relaxed text-emerald-900 border border-emerald-200 shadow-sm">
                      {review.reply.comment}
                    </div>
                    {review.reply.updateTime && (
                      <div className="text-[10px] text-muted-foreground text-right mr-1">
                        <CheckCircle2 className="inline size-3 text-emerald-500 mr-1" />
                        Published {formatAge(review.reply.updateTime)}
                      </div>
                    )}
                  </div>
                  <div className="h-9 w-9 mt-1 rounded-full bg-emerald-100 border border-emerald-200 grid place-items-center shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </div>
                </div>
              )}

              {/* Draft Editor */}
              <div id={focusId}>
                <DraftEditor
                  reviewId={review.id}
                  review={review}
                  refresh={refresh}
                />
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
