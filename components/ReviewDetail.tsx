"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { useReviewDetail, formatAge } from "@/lib/hooks"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { DraftEditor } from "@/components/DraftEditor"
import Link from "next/link"
import {
  Star,
  MapPin,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
} from "@/components/icons"

function initials(name: string | null | undefined) {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  const a = parts[0]?.[0] ?? "?"
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : ""
  return (a + b).toUpperCase()
}

function SparklesIcon({ className, weight }: { className?: string; weight?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" className={className} fill="currentColor">
      <title>Sparkles</title>
      {weight === "fill" ? (
        <path d="M216 112a8 8 0 0 1-8 8 80.1 80.1 0 0 0-80 80 8 8 0 0 1-16 0 80.1 80.1 0 0 0-80-80 8 8 0 0 1 0-16 80.1 80.1 0 0 0 80-80 8 8 0 0 1 16 0 80.1 80.1 0 0 0 80 80 8 8 0 0 1 8 8Z" />
      ) : (
        <path d="M216 112a8 8 0 0 1-8 8 80.1 80.1 0 0 0-80 80 8 8 0 0 1-16 0 80.1 80.1 0 0 0-80-80 8 8 0 0 1 0-16 80.1 80.1 0 0 0 80-80 8 8 0 0 1 16 0 80.1 80.1 0 0 0 80 80 8 8 0 0 1 8 8Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16" />
      )}
    </svg>
  )
}

function StarsRow({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5" role="img" aria-label={`${value} stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={`star-${i}-${value}`}
          weight={i < value ? "fill" : "regular"}
          className={cn(
            "h-3.5 w-3.5",
            i < value ? "fill-primary text-primary" : "text-muted-foreground/30"
          )}
        />
      ))}
    </div>
  )
}

function SentimentBadge({ stars }: { stars: number }) {
  if (stars >= 4) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100/50">
        <ThumbsUp className="size-3" weight="fill" />
        <span className="text-[10px] font-bold uppercase tracking-wider">Positive</span>
      </div>
    )
  }
  if (stars === 3) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100/50">
        <div className="size-3 rounded-full border-2 border-current opacity-60" />
        <span className="text-[10px] font-bold uppercase tracking-wider">Neutral</span>
      </div>
    )
  }
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-100/50">
      <ThumbsDown className="size-3" weight="fill" />
      <span className="text-[10px] font-bold uppercase tracking-wider">Negative</span>
    </div>
  )
}

export function ReviewDetail({ reviewId, backHref }: { reviewId: string; backHref?: string }) {
  const { review, loading, error, refresh } = useReviewDetail(reviewId)

  if (loading && !review) {
    return (
      <div className="h-full flex flex-col p-6 space-y-8 max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="h-32 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="h-20 w-20 bg-rose-50 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="h-8 w-8 text-rose-500/50" />
        </div>
        <p className="text-sm font-bold text-foreground">Unable to load review</p>
        <p className="text-xs text-muted-foreground mt-1.5 max-w-[200px]">{error}</p>
        <Button type="button" variant="ghost" onClick={() => refresh()} className="mt-6 text-xs text-primary font-bold hover:underline h-auto p-0">
          Try Again
        </Button>
      </div>
    )
  }

  if (!review) return null

  return (
    <div className="h-full flex flex-col bg-background lg:bg-transparent">
      {/* ── Header ── */}
      <header className="shrink-0 px-6 py-4 flex items-center justify-between bg-background/80 backdrop-blur-xl border-b border-border sticky top-0 z-20">
        <div className="flex items-center gap-3">
          {backHref && (
            <Link href={backHref} className="lg:hidden -ml-2 p-2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <ArrowLeft className="size-5" />
            </Link>
          )}
          <div className="flex flex-col">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              Review Details
              <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-mono text-muted-foreground/60 border-border/50 hidden sm:flex">
                {reviewId.slice(-4)}
              </Badge>
            </h2>
            <div className="text-[10px] text-muted-foreground font-medium flex items-center gap-1.5 mt-0.5">
               <MapPin className="size-3 opacity-70" />
               <span className="truncate max-w-[150px]">{review.location.name}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
           <SentimentBadge stars={review.starRating} />
        </div>
      </header>

      {/* ── Content (Chat Style) ── */}
      <div className="flex-1 overflow-hidden relative">
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-3xl mx-auto w-full pb-32">
            
            {/* Timestamp Divider */}
            <div className="flex justify-center">
              <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest bg-muted/30 px-3 py-1 rounded-full">
                {formatAge(review.createTime)}
              </span>
            </div>

            {/* User Review Message */}
            <div className="flex gap-4">
               <Avatar className="h-10 w-10 border border-border shrink-0 shadow-sm mt-1">
                 <AvatarFallback className="text-xs font-bold bg-muted text-muted-foreground">
                   {initials(review.reviewer.displayName)}
                 </AvatarFallback>
               </Avatar>
               <div className="flex flex-col gap-1.5 max-w-[85%]">
                 <div className="flex items-baseline justify-between gap-4 ml-1">
                   <span className="text-xs font-bold text-foreground">
                     {review.reviewer.displayName ?? "Anonymous"}
                   </span>
                   <StarsRow value={review.starRating} />
                 </div>
                 
                 <div className="relative group">
                   <div className="bg-card border border-border p-5 rounded-2xl rounded-tl-none shadow-sm text-sm leading-relaxed text-foreground/90">
                     {review.comment ? (
                       review.comment
                     ) : (
                       <span className="italic text-muted-foreground/60">No written comment provided</span>
                     )}
                   </div>
                   {/* Decoration */}
                   <div className="absolute top-0 left-0 -ml-2 -mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                     <div className="size-4 bg-primary/10 rounded-full blur-xl" />
                   </div>
                 </div>
               </div>
            </div>

            {/* AI Assistant / Draft Area */}
            <div className="flex gap-4 flex-row-reverse">
               <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary mt-1 shadow-glow-primary">
                 <SparklesIcon className="size-5" weight="fill" />
               </div>
               
               <div className="flex flex-col gap-1.5 max-w-[90%] w-full">
                 <div className="flex items-center justify-end gap-2 mr-1">
                   <span className="text-xs font-bold text-primary">
                     AI Assistant
                   </span>
                 </div>

                 {review.reply.comment ? (
                    // Published State
                    <div className="bg-emerald-50/80 border border-emerald-100 p-5 rounded-2xl rounded-tr-none text-sm leading-relaxed text-emerald-900 shadow-sm">
                       <div className="flex items-center gap-2 mb-2 text-emerald-700 font-bold text-xs uppercase tracking-wider">
                         <CheckCircle2 className="size-3.5" weight="fill" />
                         Published Reply
                       </div>
                       {review.reply.comment}
                       <div className="mt-3 pt-3 border-t border-emerald-200/50 text-[10px] font-medium text-emerald-600/70 text-right">
                         Posted {formatAge(review.reply.updateTime ? String(review.reply.updateTime) : "")}
                       </div>
                    </div>
                 ) : (
                    // Drafting State
                    <div className="bg-background border border-border/60 shadow-elevated rounded-2xl rounded-tr-none overflow-hidden">
                       <DraftEditor
                         reviewId={review.id}
                         review={review}
                         refresh={refresh}
                       />
                    </div>
                 )}
               </div>
            </div>

          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
