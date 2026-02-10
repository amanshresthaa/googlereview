"use client"

import { Skeleton } from "@/components/ui/skeleton"

export function ReviewListSkeleton() {
  return (
    <div className="flex flex-col divide-y divide-stone-100">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3">
          <div className="flex flex-col gap-2 flex-1">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-16 rounded-full" />
              <Skeleton className="h-4 w-14 rounded-full" />
            </div>
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-3.5 w-3/4 rounded" />
            <div className="flex items-center gap-2 mt-0.5">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-3 w-10 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
