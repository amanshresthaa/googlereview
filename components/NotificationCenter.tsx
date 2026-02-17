"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"

import { cn } from "@/lib/utils"
import { JobTracker } from "@/components/JobTracker"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  CircleHelp,
  RefreshCw,
  X,
} from "@/components/icons"

type NotificationType = "success" | "error" | "warning" | "info" | "loading"

type Notification = {
  id: string
  type: NotificationType
  title: string
  message?: string
  timestamp: Date
  jobId?: string
  action?: {
    label: string
    onClick: () => void
  }
  dismissible?: boolean
  autoClose?: boolean
  duration?: number
}

type NotificationContextValue = {
  notifications: Notification[]
  unreadCount: number
  addNotification: (notification: Omit<Notification, "id" | "timestamp">) => string
  removeNotification: (id: string) => void
  clearAll: () => void
}

const NotificationContext = React.createContext<NotificationContextValue | null>(null)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = React.useState<Notification[]>([])
  const unreadCount = notifications.length

  const removeNotification = React.useCallback((id: string) => {
    setNotifications((previous) => previous.filter((item) => item.id !== id))
  }, [])

  const addNotification = React.useCallback((notification: Omit<Notification, "id" | "timestamp">) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const next: Notification = {
      id,
      timestamp: new Date(),
      dismissible: true,
      autoClose: notification.type === "success" || notification.type === "info",
      duration: 4500,
      ...notification,
    }

    setNotifications((previous) => [next, ...previous])

    if (next.autoClose) {
      window.setTimeout(() => {
        removeNotification(id)
      }, next.duration)
    }

    return id
  }, [removeNotification])

  const clearAll = React.useCallback(() => {
    setNotifications([])
  }, [])

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        removeNotification,
        clearAll,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = React.useContext(NotificationContext)
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider")
  }
  return context
}

export function NotificationCenter({ className }: { className?: string }) {
  const [open, setOpen] = React.useState(false)
  const { notifications, unreadCount, clearAll, removeNotification } = useNotifications()

  React.useEffect(() => {
    if (open && unreadCount > 0) {
      // mark-as-read behavior: keep simple for now
    }
  }, [open, unreadCount])

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className={cn("app-action-secondary relative h-10 w-10 rounded-xl border-shell-foreground/10 bg-background/70", className)}
        onClick={() => setOpen(true)}
        aria-label="Open notifications"
      >
        <Bell className="h-4 w-4" />
        <AnimatePresence>
          {unreadCount > 0 ? (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-black text-primary-foreground"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full border-shell-foreground/10 bg-shell-foreground/10 p-0 sm:max-w-md">
          <SheetTitle className="sr-only">Notifications</SheetTitle>
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-shell-foreground/10 bg-muted/25 p-5">
              <div>
                <h2 className="text-lg font-black tracking-tight">Notifications</h2>
                <p className="app-kicker mt-1">
                  {notifications.length} {notifications.length === 1 ? "item" : "items"}
                </p>
              </div>
              {notifications.length > 0 ? (
                <Button size="sm" variant="ghost" onClick={clearAll}>
                  Clear all
                </Button>
              ) : null}
            </div>

            <ScrollArea className="flex-1">
              {notifications.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                  <div className="mb-3 grid h-14 w-14 place-items-center rounded-full bg-muted/50">
                    <Bell className="h-6 w-6 text-muted-foreground/45" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">No notifications yet</p>
                  <p className="text-xs text-muted-foreground">Background jobs and updates will appear here.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/60 p-1">
                  {notifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onDismiss={() => removeNotification(notification.id)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function NotificationItem({
  notification,
  onDismiss,
}: {
  notification: Notification
  onDismiss: () => void
}) {
  const color = colorForType(notification.type)

  return (
    <motion.div
      initial={{ opacity: 0, x: 14 }}
      animate={{ opacity: 1, x: 0 }}
      className="app-pane-card rounded-2xl border-shell-foreground/10 bg-shell-foreground/10 p-4"
    >
      <div className="flex gap-3">
        <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-2xl", color.bg)}>
          {notification.type === "loading" ? (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
              {renderNotificationIcon(notification.type, cn("h-4 w-4", color.icon))}
            </motion.div>
          ) : (
            renderNotificationIcon(notification.type, cn("h-4 w-4", color.icon))
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-black tracking-tight text-foreground">{notification.title}</p>
              {notification.dismissible ? (
                <Button variant="ghost" size="icon" className="app-action-secondary h-6 w-6 rounded-lg" onClick={onDismiss}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>

          {notification.message ? <p className="mt-0.5 text-xs text-muted-foreground">{notification.message}</p> : null}

          {notification.jobId ? (
            <div className="mt-2">
              <JobTracker
                jobId={notification.jobId}
                inline
                onComplete={(success) => {
                  if (success) {
                    onDismiss()
                  }
                }}
              />
            </div>
          ) : null}

            {notification.action ? (
              <Button variant="outline" size="sm" className="app-action-secondary mt-2 h-7 rounded-lg border-shell-foreground/10 text-xs" onClick={notification.action.onClick}>
                {notification.action.label}
              </Button>
            ) : null}

          <p className="mt-2 text-[10px] text-muted-foreground">{formatTimestamp(notification.timestamp)}</p>
        </div>
      </div>
    </motion.div>
  )
}

function renderNotificationIcon(type: NotificationType, className: string) {
  if (type === "success") return <CheckCircle2 className={className} />
  if (type === "error") return <X className={className} />
  if (type === "warning") return <AlertTriangle className={className} />
  if (type === "loading") return <RefreshCw className={className} />
  return <CircleHelp className={className} />
}

function colorForType(type: NotificationType) {
  if (type === "success") return { bg: "bg-success/10", icon: "text-success" }
  if (type === "error") return { bg: "bg-destructive/10", icon: "text-destructive" }
  if (type === "warning") return { bg: "bg-warning/10", icon: "text-warning" }
  if (type === "loading") return { bg: "bg-primary/10", icon: "text-primary" }
  return { bg: "bg-muted", icon: "text-muted-foreground" }
}

function formatTimestamp(date: Date) {
  const now = Date.now()
  const diffMs = now - date.getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
