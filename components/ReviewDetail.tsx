"use client"
import Link from "next/link"
import { motion } from "framer-motion"
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
  MessageSquare,
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
          key={`${rating}-${String(i)}`}
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
      <div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-8 p-8">
        <div className="flex items-center gap-6">
          <Skeleton className="h-20 w-20 rounded-3xl" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-8 w-64 rounded-xl" />
            <Skeleton className="h-4 w-full max-w-md rounded-lg" />
          </div>
        </div>
        <Skeleton className="h-48 w-full rounded-[32px]" />
        <Skeleton className="h-64 w-full rounded-[32px]" />
      </div>
    )
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex h-full flex-col items-center justify-center gap-6 p-10 text-center"
      >
        <div className="relative">
          <motion.div
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 rounded-full bg-destructive/10 blur-xl"
          />
          <div className="relative grid h-20 w-20 place-items-center rounded-3xl border border-destructive/20 bg-background text-destructive shadow-card">
            <AlertTriangle className="h-10 w-10" />
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-black tracking-tight text-foreground">
            Unable to load review
          </h3>
          <p className="max-w-xs text-sm font-medium text-muted-foreground leading-relaxed">
            {error}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={refresh}
          className="h-12 rounded-2xl px-8 font-bold border-border/50 shadow-sm"
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
    <div className="flex h-full flex-col bg-background/50">
      {/* ── Mobile Header ─────────────────────────────── */}
      <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-border bg-background/80 px-4 py-4 backdrop-blur-xl md:hidden">
        {backHref ? (
          <Button asChild variant="ghost" size="icon" className="app-action-secondary h-10 w-10 rounded-xl border-border/55 bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground">
            <Link href={backHref} aria-label="Back">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black tracking-tight text-foreground">
            Review Analysis
          </p>
          <div className="flex items-center gap-1.5 truncate text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
            <MapPin className="h-3 w-3 text-primary/60" />
            {review.location.name}
          </div>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-6 md:p-8">
          {/* ── Review Identity Section ─────────────────── */}
          <section className="app-surface-shell relative overflow-hidden rounded-[32px] border-border/55 bg-card/90 transition-all hover:shadow-card">
            <div className="absolute right-0 top-0 h-32 w-32 bg-primary/5 blur-3xl rounded-full -mr-16 -mt-16" />
            
            <div className="p-6 md:p-10">
              <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                  <Avatar className="h-20 w-20 shrink-0 border-4 border-primary/5 shadow-elevated">
                    <AvatarFallback
                      className={cn(
                        "bg-gradient-to-br text-2xl font-black text-white",
                        avatarColor(review.reviewer.displayName)
                      )}
                    >
                      {initials(review.reviewer.displayName)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 text-center sm:text-left space-y-3">
                    <div className="flex flex-col gap-2">
                      <h2 className="text-3xl font-black tracking-tighter text-foreground md:text-4xl">
                        {review.reviewer.displayName ?? "Anonymous"}
                      </h2>
                      {!review.reviewer.isAnonymous && (
                        <div className="flex justify-center sm:justify-start">
                          <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 text-primary px-3 py-1 text-[10px] font-bold uppercase tracking-widest">
                            Verified Profile
                          </Badge>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap justify-center sm:justify-start items-center gap-x-4 gap-y-2 text-sm font-bold text-muted-foreground/80">
                      <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-full border border-border/50">
                        <StarRating rating={review.starRating} />
                        <span className="text-xs tabular-nums text-foreground">
                          {review.starRating.toFixed(1)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 px-1">
                        <Clock className="h-4 w-4 opacity-60" />
                        {formatAge(review.createTime)} ago
                      </div>

                      <div className="flex items-center gap-2 px-1">
                        <MapPin className="h-4 w-4 text-primary/60" />
                        <span className="truncate max-w-[200px]">
                          {review.location.name}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-center gap-3">
                  <Badge
                    className={cn(
                      "rounded-full border-none px-4 py-2 text-[11px] font-black uppercase tracking-widest shadow-sm",
                      sentiment.className
                    )}
                  >
                    <span
                      className={cn(
                        "mr-2 inline-block h-2 w-2 rounded-full",
                        sentiment.dot
                      )}
                    />
                    {sentiment.label}
                  </Badge>

                  <Button
                    type="button"
                    variant="outline"
                    className="app-action-secondary h-10 rounded-xl border-border/55 bg-background px-4 text-xs font-bold shadow-sm hover:bg-muted/50"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Maps
                  </Button>
                </div>
              </div>

              {/* ── The Review Content ─────────────────── */}
              <div className="mt-10 relative">
                <div className="absolute -left-4 -top-4 text-primary/5">
                  <MessageSquare className="h-24 w-24 fill-current" />
                </div>
                  <div className="app-pane-card relative rounded-[24px] border-border/55 bg-muted/25 p-8 md:p-10 shadow-inner">
                  <p className="text-xl italic leading-relaxed text-foreground/90 font-medium md:text-2xl">
                    &ldquo;{review.comment || "No written comment provided."}&rdquo;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ── Official Response Section ─────────────── */}
          <section className="app-surface-shell overflow-hidden rounded-[32px] border-border/55 bg-card/90 transition-all hover:shadow-card">
            <div className="p-6 md:p-10 space-y-8">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-glow-primary">
                    <ShieldCheck className="h-7 w-7 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black tracking-tight text-foreground">
                      Business Response
                    </h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Official Reply Dashboard
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:items-end gap-2">
                  <div className="flex items-center gap-3">
                    {review.currentDraft?.updatedAt && (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 tabular-nums">
                        Last Active {formatAge(review.currentDraft.updatedAt)} ago
                      </span>
                    )}
                    {postedReply ? (
                      <Badge className="rounded-full bg-emerald-500/10 text-emerald-600 border-none px-4 py-1.5 text-[10px] font-black uppercase tracking-widest shadow-sm">
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        Live on GBP
                      </Badge>
                    ) : (
                      <Badge className="rounded-full bg-primary/10 text-primary border-none px-4 py-1.5 text-[10px] font-black uppercase tracking-widest shadow-sm">
                        Drafting In Progress
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {postedReply ? (
                <div className="app-pane-card relative overflow-hidden rounded-[24px] border-emerald-500/15 bg-emerald-500/[0.03] p-8 md:p-10 shadow-inner transition-all hover:bg-emerald-500/[0.05]">
                  <p className="text-lg leading-relaxed text-foreground font-medium">
                    {postedReply}
                  </p>
                  {review.reply.updateTime && (
                    <div className="mt-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Published {formatAge(review.reply.updateTime)} ago
                    </div>
                  )}
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <DraftEditor
                    reviewId={review.id}
                    review={review}
                    refresh={refresh}
                  />
                </motion.div>
              )}
            </div>
          </section>

          {/* ── Intelligence Layer ─────────────────── */}
          <section className="app-surface-shell relative overflow-hidden rounded-[32px] border-primary/25 bg-primary/5 p-8 md:p-10 transition-all hover:bg-primary/[0.08]">
            <div className="absolute right-0 bottom-0 h-40 w-40 bg-primary/5 blur-3xl rounded-full -mr-20 -mb-20" />
            
            <div className="relative space-y-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-primary">
                  Response Intelligence
                </h3>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="app-pane-card group flex items-start gap-4 rounded-2xl border-border/55 bg-background/70 p-5 shadow-sm transition-all hover:bg-background hover:shadow-card">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 transition-colors group-hover:bg-emerald-500 group-hover:text-white">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-black tracking-tight text-foreground">
                      Sentiment: {sentimentLabel(review.starRating)}
                    </p>
                    <p className="mt-2 text-xs font-medium leading-relaxed text-muted-foreground">
                      {review.starRating >= 4
                        ? "Guest is delighted. Reinforce their positive experience by using personalized thanks and a subtle invitation to return."
                        : review.starRating <= 2
                          ? "Critical feedback detected. Prioritize empathy, apologize for the specific issue, and provide a clear resolution path."
                          : "A mixed or neutral sentiment. Address any specific points mentioned while maintaining a professional and helpful tone."}
                    </p>
                  </div>
                </div>

                <div className="app-pane-card group flex items-start gap-4 rounded-2xl border-border/55 bg-background/70 p-5 shadow-sm transition-all hover:bg-background hover:shadow-card">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-black tracking-tight text-foreground">
                      SEO Optimization Tip
                    </p>
                    <p className="mt-2 text-xs font-medium leading-relaxed text-muted-foreground">
                      Google prioritizes businesses that respond within 24 hours. Fast, keyword-rich responses significantly boost your local search ranking.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  )
}
