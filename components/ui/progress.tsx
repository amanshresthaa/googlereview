"use client"

import * as React from "react"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"

type ProgressVariant = "default" | "success" | "warning" | "error"

const BAR_VARIANT_CLASS: Record<ProgressVariant, string> = {
  default: "bg-primary",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-destructive",
}

export function Progress({
  value = 0,
  className,
  indicatorClassName,
  animated = true,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  value?: number
  indicatorClassName?: string
  animated?: boolean
  variant?: ProgressVariant
}) {
  const clamped = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
      {...props}
    >
      <div
        className={cn(
          "h-full transition-[width]",
          BAR_VARIANT_CLASS[variant],
          animated ? "duration-300 ease-out" : "duration-0",
          indicatorClassName,
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

export function CircularProgress({
  value = 0,
  size = 96,
  strokeWidth = 8,
  className,
  showValue = true,
}: {
  value?: number
  size?: number
  strokeWidth?: number
  className?: string
  showValue?: boolean
}) {
  const clamped = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (clamped / 100) * circumference

  return (
    <div className={cn("relative", className)} style={{ width: size, height: size }}>
      <svg className="-rotate-90 transform" width={size} height={size}>
        <circle
          className="text-muted"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <motion.circle
          className="text-primary"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        />
      </svg>
      {showValue ? (
        <div className="absolute inset-0 grid place-items-center">
          <span className="text-xl font-black tabular-nums">{Math.round(clamped)}%</span>
        </div>
      ) : null}
    </div>
  )
}

export function IndeterminateProgress({ className }: { className?: string }) {
  return (
    <div className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <motion.div
        className="absolute h-full w-1/3 bg-primary"
        animate={{ x: ["-100%", "400%"] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
      />
    </div>
  )
}

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />
}

export function SkeletonCard() {
  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-16 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-20" />
      </div>
    </div>
  )
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  )
}
