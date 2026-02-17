"use client"

import Link from "next/link"
import { motion } from "framer-motion"

import { DraftEditor } from "@/components/DraftEditor"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Star,
  StarFilled,
  TrendingUp,
} from "@/components/icons"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { formatAge, useReviewDetail } from "@/lib/hooks"
import { cn } from "@/lib/utils"

const AVATAR_COLORS = [
  "avatar-gradient-1",
  "avatar-gradient-2",
  "avatar-gradient-3",
  "avatar-gradient-4",
  "avatar-gradient-5",
  "avatar-gradient-6",
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
  const first = parts[0]?.[0] ?? "?"
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : ""
  return (first + last).toUpperCase()
}

function sentimentConfig(stars: number) {
  if (stars >= 4) {
    return {
      label: "Positive",
      chip: "border-success/20 bg-success/10 text-success-soft",
      dot: "bg-success-soft",
      guidance:
        "Guest sentiment is strong. Keep the response warm and personal, then invite them back with a specific touchpoint.",
    }
  }
  if (stars <= 2) {
    return {
      label: "Negative",
      chip: "border-destructive/20 bg-destructive/10 text-destructive-foreground",
      dot: "bg-destructive",
      guidance:
        "Critical feedback detected. Lead with accountability, address the issue directly, and explain your corrective follow-up.",
    }
  }
  return {
    label: "Neutral",
    chip: "border-warning/20 bg-warning/10 text-warning-soft",
    dot: "bg-warning-soft",
    guidance:
      "Mixed sentiment. Confirm what went well, acknowledge any gaps, and keep the response concise and service-focused.",
  }
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => {
        const Icon = index < rating ? StarFilled : Star
        return (
          <Icon
            key={`${rating}-${String(index)}`}
            className={cn("h-4 w-4", index < rating ? "text-warning-soft" : "text-shell-foreground/15")}
          />
        )
      })}
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
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <div className="rounded-3xl border border-shell-foreground/5 bg-shell-foreground/5 p-5 backdrop-blur-md sm:p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-2xl bg-shell-foreground/10" />
            <div className="min-w-0 flex-1 space-y-3">
              <Skeleton className="h-6 w-52 rounded-lg bg-shell-foreground/10" />
              <Skeleton className="h-4 w-full max-w-sm rounded-lg bg-shell-foreground/10" />
            </div>
          </div>
        </div>
        <Skeleton className="h-44 w-full rounded-3xl bg-shell-foreground/10" />
        <Skeleton className="h-72 w-full rounded-3xl bg-shell-foreground/10" />
      </div>
    )
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex h-full flex-col items-center justify-center gap-5 px-6 text-center"
      >
        <div className="grid h-16 w-16 place-items-center rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold tracking-tight text-shell-foreground">Unable to load review</h3>
          <p className="max-w-sm text-sm text-shell-foreground/60">{error}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={refresh}
          className="h-10 rounded-xl border-shell-foreground/10 bg-shell-foreground/5 px-5 text-xs font-bold text-shell-foreground hover:bg-shell-foreground/10"
        >
          Try Again
        </Button>
      </motion.div>
    )
  }

  if (!review) return null

  const postedReply = review.reply.comment
  const sentiment = sentimentConfig(review.starRating)

  return (
    <div className="flex h-full flex-col bg-shell text-shell-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-shell-foreground/[0.08] bg-shell/90 px-4 py-4 backdrop-blur-xl md:hidden">
        {backHref ? (
          <Button asChild variant="ghost" size="icon" className="h-9 w-9 rounded-lg border border-shell-foreground/10 bg-shell-foreground/5 text-shell-foreground/60 hover:bg-shell-foreground/10 hover:text-shell-foreground">
            <Link href={backHref} aria-label="Back to inbox">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold tracking-tight text-shell-foreground">Review Analysis</p>
          <div className="flex items-center gap-1.5 truncate text-[10px] font-bold uppercase tracking-widest text-shell-foreground/45">
            <MapPin className="h-3 w-3" />
            {review.location.name}
          </div>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
          <section className="rounded-3xl border border-shell-foreground/5 bg-shell-foreground/5 p-5 shadow-xl shadow-shell/20 backdrop-blur-md sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <Avatar className="h-14 w-14 shrink-0 rounded-2xl border border-shell-foreground/10">
                  <AvatarFallback className={cn("bg-gradient-to-br text-lg font-black text-shell-foreground", avatarColor(review.reviewer.displayName))}>
                    {initials(review.reviewer.displayName)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-xl font-bold tracking-tight text-shell-foreground sm:text-2xl">
                      {review.reviewer.displayName ?? "Anonymous User"}
                    </h2>
                    {review.reviewer.isAnonymous ? (
                      <Badge className="rounded-full border border-shell-foreground/10 bg-shell-foreground/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-shell-foreground/50">
                        Anon
                      </Badge>
                    ) : (
                      <Badge className="rounded-full border border-brand/20 bg-brand/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-muted">
                        Verified Profile
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-shell-foreground/45">
                    <div className="inline-flex items-center gap-2 rounded-full border border-shell-foreground/10 bg-shell-foreground/5 px-3 py-1.5">
                      <StarRating rating={review.starRating} />
                      <span className="text-xs font-semibold tabular-nums text-shell-foreground/80">{review.starRating.toFixed(1)}</span>
                    </div>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {formatAge(review.createTime)} ago
                    </span>
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="truncate">{review.location.name}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:justify-end">
                <Badge className={cn("rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider", sentiment.chip)}>
                  <span className={cn("mr-1.5 inline-block h-1.5 w-1.5 rounded-full", sentiment.dot)} />
                  {sentiment.label}
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-xl border-shell-foreground/10 bg-shell-foreground/5 px-3 text-xs font-bold text-shell-foreground/70 hover:bg-shell-foreground/10 hover:text-shell-foreground"
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Maps
                </Button>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-shell-foreground/10 bg-shell/35 p-4 sm:p-5">
              <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-shell-foreground/5 text-shell-foreground/40">
                <MessageSquare className="h-4 w-4" />
              </div>
              <p className="text-[15px] italic leading-relaxed text-shell-foreground/75 sm:text-base">
                &ldquo;{review.comment || "No written comment provided."}&rdquo;
              </p>
            </div>
          </section>

          <section className="rounded-3xl border border-shell-foreground/5 bg-shell-foreground/5 p-5 shadow-xl shadow-shell/20 backdrop-blur-md sm:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/20 text-brand-muted">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight text-shell-foreground sm:text-lg">Business Response</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-shell-foreground/40">Official Reply Workflow</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {review.currentDraft?.updatedAt ? (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-shell-foreground/35">
                    Last edited {formatAge(review.currentDraft.updatedAt)} ago
                  </span>
                ) : null}
                {postedReply ? (
                  <Badge className="rounded-full border border-success/20 bg-success/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-success-soft">
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    Live on GBP
                  </Badge>
                ) : (
                  <Badge className="rounded-full border border-brand/20 bg-brand/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-muted">
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    Draft in Progress
                  </Badge>
                )}
              </div>
            </div>

            {postedReply ? (
              <div className="rounded-2xl border border-success/20 bg-success/10 p-4 sm:p-5">
                <p className="text-sm leading-relaxed text-shell-foreground/80 sm:text-[15px]">{postedReply}</p>
                {review.reply.updateTime ? (
                  <div className="mt-4 text-[10px] font-bold uppercase tracking-widest text-shell-foreground/40">
                    Published {formatAge(review.reply.updateTime)} ago
                  </div>
                ) : null}
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="rounded-2xl border border-shell-foreground/10 bg-shell/25 p-3 sm:p-4"
              >
                <DraftEditor
                  reviewId={review.id}
                  review={review}
                  refresh={refresh}
                />
              </motion.div>
            )}
          </section>

          <section className="rounded-3xl border border-brand/15 bg-brand/10 p-5 shadow-xl shadow-shell/20 backdrop-blur-md sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/20 text-brand-muted">
                <Sparkles className="h-4 w-4" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-brand/80">Response Intelligence</h3>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl border border-shell-foreground/10 bg-shell/30 p-4">
                <div className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-shell-foreground/70">
                  <CheckCircle2 className="h-4 w-4 text-success-soft" />
                  Sentiment Guidance
                </div>
                <p className="text-sm leading-relaxed text-shell-foreground/70">{sentiment.guidance}</p>
              </div>

              <div className="rounded-2xl border border-shell-foreground/10 bg-shell/30 p-4">
                <div className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-shell-foreground/70">
                  <TrendingUp className="h-4 w-4 text-brand/80" />
                  SEO Momentum
                </div>
                <p className="text-sm leading-relaxed text-shell-foreground/70">
                  Responding quickly and using relevant local context helps improve visibility and trust signals in local search.
                </p>
              </div>
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  )
}
