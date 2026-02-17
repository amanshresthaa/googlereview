import * as React from "react"
import { cn } from "@/lib/utils"

/* ─────────────────────────────────────────────────────────
   EmptyState
   A centered illustration + message + optional action slot.
   ───────────────────────────────────────────────────────── */

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Remix icon, Lucide icon, or custom SVG */
    icon?: React.ReactNode
    /** Primary headline */
    title: string
    /** Supporting copy (1-2 sentences) */
    description?: string
    /** CTA button or link */
    action?: React.ReactNode
}

export function EmptyState({
    icon,
    title,
    description,
    action,
    className,
    ...props
}: EmptyStateProps) {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center gap-4 px-6 py-16 text-center",
                className,
            )}
            {...props}
        >
            {icon ? (
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-shell-foreground/10 bg-shell-foreground/5 text-shell-foreground/40 shadow-card motion-all motion-standard">
                    {icon}
                </div>
            ) : null}
            <div className="max-w-sm space-y-1.5">
                <h3 className="type-section text-shell-foreground/85">{title}</h3>
                {description ? (
                    <p className="type-body text-shell-foreground/55">{description}</p>
                ) : null}
            </div>
            {action ? <div className="mt-2">{action}</div> : null}
        </div>
    )
}

/* ─────────────────────────────────────────────────────────
   ErrorState
   A destructive variant of the empty state for error display.
   ───────────────────────────────────────────────────────── */

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
    icon?: React.ReactNode
    title?: string
    description?: string
    /** Retry CTA or fallback action */
    action?: React.ReactNode
}

export function ErrorState({
    icon,
    title = "Something went wrong",
    description = "An unexpected error occurred. Please try again.",
    action,
    className,
    ...props
}: ErrorStateProps) {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center gap-4 px-6 py-16 text-center",
                className,
            )}
            {...props}
        >
            {icon ? (
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-state-error-border bg-state-error-bg text-state-error-fg shadow-card motion-all motion-standard">
                    {icon}
                </div>
            ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-state-error-border bg-state-error-bg text-state-error-fg shadow-card">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                </div>
            )}
            <div className="max-w-sm space-y-1.5">
                <h3 className="type-section text-state-error-fg">{title}</h3>
                <p className="type-body text-shell-foreground/55">{description}</p>
            </div>
            {action ? <div className="mt-2">{action}</div> : null}
        </div>
    )
}

/* ─────────────────────────────────────────────────────────
   LoadingState
   A skeleton-based loading placeholder with configurable items.
   ───────────────────────────────────────────────────────── */

export interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Number of skeleton rows to show */
    rows?: number
    /** Visual style */
    variant?: "card" | "list" | "inline"
}

export function LoadingState({
    rows = 3,
    variant = "card",
    className,
    ...props
}: LoadingStateProps) {
    if (variant === "inline") {
        return (
            <div
                className={cn("flex items-center justify-center gap-3 py-8", className)}
                role="status"
                aria-label="Loading"
                {...props}
            >
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
                <span className="type-caption text-shell-foreground/50">Loading…</span>
            </div>
        )
    }

    return (
        <div
            className={cn("space-y-3", className)}
            role="status"
            aria-label="Loading"
            {...props}
        >
            {Array.from({ length: rows }, (_, i) => (
                <div
                    key={i}
                    className={cn(
                        "animate-pulse rounded-2xl border border-shell-foreground/10 p-4",
                        variant === "card" ? "app-pane-card" : "",
                    )}
                >
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-shell-foreground/10" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 w-32 rounded bg-shell-foreground/10" />
                            <div className="h-3 w-20 rounded bg-shell-foreground/10" />
                        </div>
                    </div>
                    {variant === "card" ? (
                        <div className="mt-3 space-y-2">
                            <div className="h-3 w-full rounded bg-shell-foreground/8" />
                            <div className="h-3 w-3/4 rounded bg-shell-foreground/8" />
                        </div>
                    ) : null}
                </div>
            ))}
        </div>
    )
}
