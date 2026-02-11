"use client"

import * as React from "react"
import { AlertTriangle, MessageSquare, Search } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    variant?: "default" | "secondary" | "outline" | "ghost"
  }
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-12 text-center", className)} role="status">
      {icon ? (
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted ring-1 ring-border/50">
          <div className="text-muted-foreground/60 [&>svg]:h-10 [&>svg]:w-10">{icon}</div>
        </div>
      ) : null}
      <h3 className="mb-2 text-base font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="mb-6 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {action ? (
        <Button variant={action.variant || "default"} onClick={action.onClick} className="shadow-elevated">
          {action.label}
        </Button>
      ) : null}
    </div>
  )
}

export function EmptyInboxState({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <EmptyState
      icon={<MessageSquare />}
      title="Inbox is empty"
      description="All caught up. New reviews will appear here automatically."
      action={
        onRefresh
          ? {
              label: "Refresh",
              onClick: onRefresh,
              variant: "outline",
            }
          : undefined
      }
    />
  )
}

export function EmptySearchState({ query }: { query?: string }) {
  return (
    <EmptyState
      icon={<Search />}
      title="No results found"
      description={
        query
          ? `No reviews match \"${query}\". Try adjusting your search or filters.`
          : "Try adjusting your search or filters to find what you're looking for."
      }
    />
  )
}

export function EmptyErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <EmptyState
      icon={<AlertTriangle />}
      title="Something went wrong"
      description="We couldn't load this content. Please try again."
      action={
        onRetry
          ? {
              label: "Try again",
              onClick: onRetry,
              variant: "outline",
            }
          : undefined
      }
    />
  )
}
