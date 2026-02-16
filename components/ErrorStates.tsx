"use client"

import * as React from "react"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { AlertTriangle, ArrowLeft, RefreshCw, X } from "@/components/icons"

type ErrorBoundaryProps = {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

type ErrorBoundaryState = {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  reset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const Fallback = this.props.fallback
      if (Fallback) {
        return <Fallback error={this.state.error} reset={this.reset} />
      }
      return <DefaultErrorFallback error={this.state.error} reset={this.reset} />
    }

    return this.props.children
  }
}

function DefaultErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[360px] items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md text-center"
      >
        <div className="mb-6 flex justify-center">
          <div className="app-pane-card grid h-20 w-20 place-items-center rounded-full bg-destructive/10">
            <X className="h-10 w-10 text-destructive" />
          </div>
        </div>
        <h2 className="mb-2 text-2xl font-black tracking-tight">Something went wrong</h2>
        <p className="mb-6 text-sm text-muted-foreground">{error.message || "An unexpected error occurred."}</p>
        <div className="flex justify-center gap-3">
            <Button onClick={reset} variant="outline" className="app-action-secondary rounded-xl border-border/55">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button onClick={() => window.location.reload()} className="app-action-primary rounded-xl">Reload</Button>
          </div>
        </motion.div>
      </div>
  )
}

export function ErrorState({
  error,
  title = "Something went wrong",
  description,
  onRetry,
  showBackButton = false,
  className,
}: {
  error: string | Error
  title?: string
  description?: string
  onRetry?: () => void
  showBackButton?: boolean
  className?: string
}) {
  const message = typeof error === "string" ? error : error.message
  const normalized = message.toLowerCase()
  const isSessionExpired = message === "SESSION_EXPIRED"
  const isNotFound = normalized.includes("404") || normalized.includes("not found")
  const isForbidden = normalized.includes("403") || normalized.includes("forbidden")

  if (isSessionExpired) {
    return <SessionExpiredError />
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex min-h-[280px] items-center justify-center p-8", className)}
    >
      <div className="max-w-md text-center">
          <div className="mb-5 flex justify-center">
            <div className="app-pane-card grid h-16 w-16 place-items-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </div>
        <h3 className="mb-2 text-xl font-black tracking-tight">{title}</h3>
        <p className="mb-1 text-sm text-muted-foreground">{description || message}</p>
        {isNotFound ? (
          <p className="mt-2 text-xs text-muted-foreground/70">The review could not be found in this organization.</p>
        ) : null}
        {isForbidden ? (
          <p className="mt-2 text-xs text-muted-foreground/70">You do not have permission for this action.</p>
        ) : null}
        <div className="mt-6 flex justify-center gap-3">
          {showBackButton ? (
            <Button variant="outline" onClick={() => window.history.back()} className="app-action-secondary rounded-xl border-border/55">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
          ) : null}
          {onRetry ? (
            <Button onClick={onRetry} className="app-action-primary rounded-xl">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          ) : null}
        </div>
      </div>
    </motion.div>
  )
}

function SessionExpiredError() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex min-h-[300px] items-center justify-center p-8"
    >
      <div className="max-w-md text-center">
          <div className="mb-5 flex justify-center">
            <div className="app-pane-card grid h-16 w-16 place-items-center rounded-full bg-amber-500/10">
              <AlertTriangle className="h-8 w-8 text-amber-600" />
            </div>
          </div>
        <h3 className="mb-2 text-xl font-black tracking-tight">Session expired</h3>
        <p className="mb-6 text-sm text-muted-foreground">Please sign in again to continue.</p>
        <Button
          onClick={() => {
            window.location.href = "/signin"
          }}
          className="app-action-primary rounded-xl"
        >
          Sign In
        </Button>
      </div>
    </motion.div>
  )
}

export function EmptyState({
  icon: Icon = AlertTriangle,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex min-h-[280px] items-center justify-center p-8 text-center", className)}
    >
      <div className="max-w-md">
          <div className="mb-5 flex justify-center">
            <div className="app-pane-card grid h-16 w-16 place-items-center rounded-full bg-muted/40">
              <Icon className="h-8 w-8 text-muted-foreground/45" />
            </div>
          </div>
        <h3 className="mb-2 text-xl font-black tracking-tight">{title}</h3>
        <p className="mb-6 text-sm leading-relaxed text-muted-foreground">{description}</p>
        {action ? <Button onClick={action.onClick} className="app-action-primary rounded-xl">{action.label}</Button> : null}
      </div>
    </motion.div>
  )
}

export function LoadingState({
  message = "Loading...",
  description,
  className,
}: {
  message?: string
  description?: string
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn("flex min-h-[260px] items-center justify-center p-8", className)}
    >
      <div className="text-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="mb-4 flex justify-center"
        >
          <RefreshCw className="h-8 w-8 text-primary" />
        </motion.div>
        <p className="text-sm font-semibold text-foreground">{message}</p>
        {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      </div>
    </motion.div>
  )
}

export function InlineError({
  error,
  className,
}: {
  error: string
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className={cn("flex items-center gap-2 text-sm text-destructive", className)}
    >
      <AlertTriangle className="h-4 w-4" />
      <span>{error}</span>
    </motion.div>
  )
}

export function NetworkError({ onRetry }: { onRetry: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex min-h-[280px] items-center justify-center p-8"
    >
      <div className="max-w-md text-center">
          <div className="mb-5 flex justify-center">
            <div className="app-pane-card grid h-16 w-16 place-items-center rounded-full bg-amber-500/10">
              <AlertTriangle className="h-8 w-8 text-amber-600" />
            </div>
          </div>
        <h3 className="mb-2 text-xl font-black tracking-tight">Connection problem</h3>
        <p className="mb-6 text-sm text-muted-foreground">We could not reach the server. Check your network and retry.</p>
        <Button onClick={onRetry} className="app-action-primary rounded-xl">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry Connection
        </Button>
      </div>
    </motion.div>
  )
}
