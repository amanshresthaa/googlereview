"use client"

import * as React from "react"
import { Loader2 } from "@/components/icons"
import { cn } from "@/lib/utils"

const spinnerSizes = {
  sm: "h-3 w-3",
  default: "h-4 w-4",
  lg: "h-6 w-6",
  xl: "h-8 w-8",
} as const

interface LoadingSpinnerProps {
  size?: keyof typeof spinnerSizes
  className?: string
  label?: string
}

export function LoadingSpinner({
  size = "default",
  className,
  label = "Loading",
}: LoadingSpinnerProps) {
  return (
    <div className={cn("flex items-center justify-center", className)} role="status" aria-label={label}>
      <Loader2 className={cn("text-primary animate-spin", spinnerSizes[size])} />
      <span className="sr-only">{label}</span>
    </div>
  )
}

interface LoadingOverlayProps {
  visible: boolean
  label?: string
}

export function LoadingOverlay({ visible, label = "Loading..." }: LoadingOverlayProps) {
  if (!visible) return null

  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
      role="alert"
      aria-busy="true"
      aria-label={label}
    >
      <div className="flex flex-col items-center gap-3">
        <LoadingSpinner size="lg" label={label} />
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

interface LoadingCardProps {
  message?: string
  className?: string
}

export function LoadingCard({ message = "Loading...", className }: LoadingCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-12 rounded-2xl border border-border bg-card",
        className,
      )}
      role="status"
      aria-label={message}
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <LoadingSpinner size="lg" label={message} />
      </div>
      <p className="text-sm font-medium text-foreground">{message}</p>
      <p className="mt-1 text-xs text-muted-foreground">Please wait...</p>
    </div>
  )
}
