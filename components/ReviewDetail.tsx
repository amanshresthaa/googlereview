"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { formatAge, useReviewDetail } from "@/lib/hooks"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { DraftEditor } from "@/components/DraftEditor"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  ShieldCheck,
  Star,
  Sparkles,
  TrendingUp,
} from "@/components/icons"

const AVATAR_COLORS = [
  "from-violet-500 to-indigo-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-emerald-500 to-teal-600",
  "from-sky-500 to-cyan-600",
  "from-fuchsia-500 to-purple-600",
] as const

function avatarColor(name: string | null | undefined): string {
  if (!name) return AVATAR_COLORS[0]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function initials(name: string | null | undefined) {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  const a = parts[0]?.[0] ?? "?"
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : ""
  return (a + b).toUpperCase()
}

function sentimentLabel(stars: number) {
  if (stars >= 4) return "Positive"
  if (stars <= 2) return "Negative"
  return "Neutral"
}

function sentimentConfig(stars: number) {
  if (stars >= 4)
    return {
      label: "Positive",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
      dot: "bg-emerald-500",
    }
  if (stars <= 2)
    return {
      label: "Negative",
      className:
        "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300",
      dot: "bg-red-500",
    }
  return {
    label: "Neutral",
    className:
      "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300",
    dot: "bg-yellow-500",
  }
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          weight={i < rating ? "fill" : "regular"}
          className={cn(
            "h-4 w-4",
            i < rating
              ? "text-amber-400"
              : "text-muted-foreground/30"
          )}
        />
      ))}
    </span>
  )
}

export function ReviewDetail({
  reviewId,
  backHref,
}: {
  reviewId: string
  backHref?: string
}) {
  const { review, loading, error, refresh } = useReviewDetail(reviewId)

  if (loading && !review) {
    return (
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-6 p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-48 rounded-lg" />
            <Skeleton className="h-4 w-72 rounded-lg" />
          </div>
        </div>
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">
            Unable to load review
          </p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            {error}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={refresh}
          className="mt-1 rounded-full"
        >
          Try Again
        </Button>
      </div>
    )
  }

  if (!review) return null

  const postedReply = review.reply.comment
  const sentiment = sentimentConfig(review.starRating)

  return (
    <div className="flex h-full flex-col bg-background">
      {/* ── Mobile header ─────────────────────────────── */}
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-card/95 px-4 py-3 backdrop-blur-sm md:hidden">
        {backHref ? (
          <Link
            href={backHref}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            Review Details
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {review.location.name}
          </p>
        </div>
      </header>

      <ScrollArea className="h-full">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:p-6 lg:p-8">
          {/* ── Review header section ─────────────────── */}
          <section className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-muted/50 to-card shadow-sm">
            <div className="p-5 md:p-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  <Avatar className="h-16 w-16 shrink-0 ring-2 ring-background ring-offset-2 ring-offset-muted">
                    <AvatarFallback
                      className={cn(
                        "bg-gradient-to-br text-lg font-bold text-white",
                        avatarColor(review.reviewer.displayName)
                      )}
                    >
                      {initials(review.reviewer.displayName)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0">
                    <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                      {review.reviewer.displayName ?? "Anonymous"}
                    </h2>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                        <StarRating rating={review.starRating} />
                        <span className="text-xs tabular-nums">
                          {review.starRating.toFixed(1)}
                        </span>
                      </span>

                      <span className="text-border">|</span>

                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatAge(review.createTime)} ago
                      </span>

                      <span className="text-border">|</span>

                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="truncate">
                          {review.location.name}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2.5">
                  <Badge
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-semibold",
                      sentiment.className
                    )}
                  >
                    <span
                      className={cn(
                        "mr-1.5 inline-block h-1.5 w-1.5 rounded-full",
                        sentiment.dot
                      )}
                    />
                    {sentiment.label}
                  </Badge>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-full text-xs"
                  >
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    View on Maps
                  </Button>
                </div>
              </div>

              {/* ── Review content (quoted text) ──────── */}
              <div className="mt-6 rounded-xl border border-border bg-card p-5 md:p-6">
                <p className="text-base italic leading-relaxed text-foreground/90 md:text-lg">
                  &ldquo;
                  {review.comment || "No written comment provided."}
                  &rdquo;
                </p>
              </div>
            </div>
          </section>

          {/* ── Official Response section ─────────────── */}
          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="space-y-5 p-5 md:p-8">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Official Response
                    </p>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Reply as Business Owner
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {review.currentDraft?.updatedAt ? (
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      Updated {formatAge(review.currentDraft.updatedAt)} ago
                    </span>
                  ) : null}
                  {postedReply ? (
                    <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                      Published
                    </Badge>
                  ) : (
                    <Badge className="rounded-full border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
                      Ready to Draft
                    </Badge>
                  )}
                </div>
              </div>

              {postedReply ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                  <p className="text-sm leading-relaxed text-foreground">
                    {postedReply}
                  </p>
                  {review.reply.updateTime ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Posted {formatAge(review.reply.updateTime)} ago
                    </p>
                  ) : null}
                </div>
              ) : (
                <DraftEditor
                  reviewId={review.id}
                  review={review}
                  refresh={refresh}
                />
              )}
            </div>
          </section>

          {/* ── Response Intelligence footer ─────────── */}
          <section className="rounded-2xl border border-dashed border-sky-300/60 bg-sky-50/40 p-5 dark:border-sky-700/40 dark:bg-sky-950/20 md:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-sky-700 dark:text-sky-300">
                Response Intelligence
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-2.5 rounded-lg bg-white/70 p-3 dark:bg-white/5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    Sentiment: {sentimentLabel(review.starRating)}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    {review.starRating >= 4
                      ? "Reinforce positive experience by thanking the guest and inviting them back."
                      : review.starRating <= 2
                        ? "Acknowledge the concern, apologize sincerely, and offer a resolution path."
                        : "Address specific points mentioned and highlight improvements."}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-lg bg-white/70 p-3 dark:bg-white/5">
                <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    Response Time SEO Tip
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    Replies within 24 hours improve local search ranking and
                    signal active management to potential customers.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  )
}
