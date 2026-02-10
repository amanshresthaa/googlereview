"use client"

import { useReviewDetail } from "@/lib/hooks"
import { ReviewDetailPanel } from "@/components/ReviewDetailPanel"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertTriangle } from "lucide-react"
import Link from "next/link"

type Props = {
  reviewId: string
}

export function ReviewDeepLink({ reviewId }: Props) {
  const { review, loading, error, refresh } = useReviewDetail(reviewId)

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  if (error || !review) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <Link
          href="/inbox"
          className="text-sm text-stone-500 hover:text-stone-800 transition-colors"
        >
          ← Back to Inbox
        </Link>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex gap-2 text-red-700 text-sm items-center">
          <AlertTriangle size={16} />
          {error === "SESSION_EXPIRED"
            ? "Session expired. Please sign in again."
            : error ?? "Review not found"}
        </div>
      </div>
    )
  }

  return (
    <ReviewDetailPanel review={review} onRefresh={refresh} showBackLink />
  )
}
