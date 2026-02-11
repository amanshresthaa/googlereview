import * as React from "react"

import { cn } from "@/lib/utils"
import { Star } from "@/components/icons"

type StarsProps = {
  rating: number
  size?: "xs" | "sm" | "md"
}

export function Stars({ rating, size = "sm" }: StarsProps) {
  const sizeClass = size === "xs" ? "h-3 w-3" : size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"

  return (
    <div className="flex items-center gap-0.5" role="img" aria-label={`${rating} stars`}>
      {Array.from({ length: 5 }, (_, index) => {
        const filled = index < rating
        return (
          <Star
            key={`${rating}-${String(index)}`}
            weight={filled ? "fill" : "regular"}
            className={cn(sizeClass, filled ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/25")}
          />
        )
      })}
    </div>
  )
}
