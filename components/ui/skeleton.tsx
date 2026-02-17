"use client"

import { cn } from "@/lib/utils"

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-md bg-shell-foreground/10 animate-pulse", className)} {...props} />
  )
}
