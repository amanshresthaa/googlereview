"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"

import { SearchProvider } from "@/components/search-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  BarChart3 as BarChart,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Globe,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Settings,
  Sparkles,
} from "lucide-react"
import { JobHealthWidget } from "@/components/JobHealthWidget"
import { REPLYAI_UNANSWERED_COUNT_EVENT } from "@/lib/reviews/count-events"
import { cn } from "@/lib/utils"

type UserShape = {
  name: string | null
  email: string | null
  image: string | null
  role: string
}

type NavItem = {
  href: string
  label: string
  shortLabel: string
  Icon: React.ElementType
}

const SIDEBAR_COLLAPSE_STORAGE_KEY = "replyai.sidebarCollapsed"
const UNANSWERED_CACHE_TTL_MS = 20_000
const UNANSWERED_POLL_INTERVAL_MS = 60_000
const ICON_STROKE = 2.6

let unansweredCountCache = {
  value: 0,
  updatedAt: 0,
}

function isNavItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function useUnansweredCountPolling() {
  const [count, setCount] = React.useState<number>(() => unansweredCountCache.value)
  const pathname = usePathname()
  const onInboxPage = pathname.startsWith("/inbox")
  const pollEnabled = !onInboxPage
  const [isVisible, setIsVisible] = React.useState(() => {
    if (typeof document === "undefined") return true
    return document.visibilityState === "visible"
  })

  React.useEffect(() => {
    const onCountUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ count?: unknown }>).detail
      const next = Number(detail?.count)
      if (!Number.isFinite(next)) return
      unansweredCountCache = { value: next, updatedAt: Date.now() }
      setCount(next)
    }

    window.addEventListener(REPLYAI_UNANSWERED_COUNT_EVENT, onCountUpdate as EventListener)
    return () => {
      window.removeEventListener(REPLYAI_UNANSWERED_COUNT_EVENT, onCountUpdate as EventListener)
    }
  }, [])

  React.useEffect(() => {
    const onVisibilityChange = () => {
      setIsVisible(document.visibilityState === "visible")
    }

    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [])

  React.useEffect(() => {
    if (!pollEnabled || !isVisible) return

    let mounted = true
    let timer: ReturnType<typeof setInterval> | null = null
    let inflightController: AbortController | null = null

    const run = async () => {
      inflightController?.abort()
      inflightController = new AbortController()
      try {
        const res = await fetch("/api/reviews/counts", {
          signal: inflightController.signal,
        })
        if (!mounted || !res.ok) return
        const data = await res.json()
        const next = Number(data?.counts?.unanswered)
        if (Number.isFinite(next)) {
          unansweredCountCache = { value: next, updatedAt: Date.now() }
          setCount(next)
        }
      } catch {
        // ignore polling failures
      }
    }

    const cacheIsFresh = Date.now() - unansweredCountCache.updatedAt < UNANSWERED_CACHE_TTL_MS
    if (cacheIsFresh) {
      setCount(unansweredCountCache.value)
    } else {
      void run()
    }

    timer = setInterval(run, UNANSWERED_POLL_INTERVAL_MS)
    return () => {
      mounted = false
      inflightController?.abort()
      if (timer) clearInterval(timer)
    }
  }, [pollEnabled, isVisible])

  return count
}

function viewLabelForPath(pathname: string) {
  if (pathname.startsWith("/inbox") || pathname.startsWith("/reviews/")) return "Inbox"
  if (pathname.startsWith("/locations")) return "Locations"
  if (pathname.startsWith("/settings")) return "Settings"
  if (pathname.startsWith("/system-health")) return "System Health"
  return "Inbox"
}

function initials(name: string | null | undefined) {
  if (!name) return "U"
  const parts = name.trim().split(/\s+/)
  const a = parts[0]?.[0] ?? "U"
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : ""
  return `${a}${b}`.toUpperCase()
}

function CountBadge({ active, count }: { active: boolean; count: number }) {
  return (
    <Badge
      className={cn(
        "rounded-full border px-1.5 py-0 text-[10px] font-black tabular-nums",
        active
          ? "border-brand-muted/50 bg-brand text-brand-foreground"
          : "border-brand/30 bg-brand/20 text-brand-muted",
      )}
    >
      {count > 99 ? "99+" : count}
    </Badge>
  )
}

export function AppShell({
  user,
  children,
}: {
  user: UserShape
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const unanswered = useUnansweredCountPolling()
  const viewLabel = viewLabelForPath(pathname)
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY)
      if (raw) setSidebarCollapsed(raw === "1")
    } catch {
      // Ignore storage failures.
    }
  }, [])

  React.useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, sidebarCollapsed ? "1" : "0")
    } catch {
      // Ignore storage failures.
    }
  }, [sidebarCollapsed])

  const items: NavItem[] = [
    { href: "/inbox", label: "Inbox", shortLabel: "Inbox", Icon: MessageSquare },
    { href: "/locations", label: "Locations", shortLabel: "Places", Icon: LayoutDashboard },
    { href: "/settings", label: "Settings", shortLabel: "Settings", Icon: Settings },
    { href: "/system-health", label: "System Health", shortLabel: "Health", Icon: BarChart },
  ]

  return (
    <SearchProvider>
      <TooltipProvider delayDuration={220}>
        <div className="relative flex h-[100dvh] min-h-[100dvh] w-full overflow-hidden bg-shell text-shell-foreground">
          {/* Background orbs */}
          <div className="pointer-events-none absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-brand/15 blur-[120px]" />
          <div className="pointer-events-none absolute -bottom-40 -right-40 h-[450px] w-[450px] rounded-full bg-success/10 blur-[120px]" />
          <div className="pointer-events-none absolute left-1/2 top-1/3 h-[350px] w-[350px] -translate-x-1/2 rounded-full bg-brand/5 blur-[100px]" />

          {/* Desktop sidebar */}
          <aside
            className={cn(
              "relative z-20 hidden h-full p-3 lg:flex",
              sidebarCollapsed ? "w-[94px]" : "w-[290px]",
            )}
          >
            <div className="flex h-full w-full flex-col rounded-[34px] border border-shell-foreground/[0.08] bg-shell-foreground/[0.03] shadow-floating backdrop-blur-2xl">
              <div className="flex items-center justify-between border-b border-shell-foreground/[0.08] px-4 py-4">
                <Link
                  href="/inbox"
                  className={cn("flex items-center", sidebarCollapsed ? "gap-0" : "gap-3")}
                  aria-label="Go to inbox"
                >
                    <div className="brand-duo-gradient grid h-11 w-11 place-items-center rounded-2xl text-brand-foreground shadow-glow-primary">
                     <Sparkles className="h-5 w-5" strokeWidth={ICON_STROKE} />
                  </div>
                  <div
                    className={cn(
                      "overflow-hidden whitespace-nowrap transition-all duration-300",
                      sidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[170px] opacity-100",
                    )}
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-shell-foreground/40">Tahoe</p>
                    <p className="text-lg font-black tracking-[-0.03em] text-shell-foreground">ReplyAI</p>
                  </div>
                </Link>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setSidebarCollapsed((prev) => !prev)}
                      aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                      className="h-8 w-8 rounded-xl text-shell-foreground/30 hover:bg-shell-foreground/[0.06] hover:text-shell-foreground/60"
                    >
                       {sidebarCollapsed ? <ChevronRight className="h-4 w-4" strokeWidth={ICON_STROKE} /> : <ChevronLeft className="h-4 w-4" strokeWidth={ICON_STROKE} />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{sidebarCollapsed ? "Expand" : "Collapse"}</TooltipContent>
                </Tooltip>
              </div>

              <ScrollArea className="flex-1 px-3 py-4">
                <nav className="space-y-2" aria-label="Main navigation">
                  {items.map((item) => {
                    const isActive = isNavItemActive(pathname, item.href)
                    const showCount = item.href === "/inbox" && unanswered > 0

                    return (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>
                          <Link
                            href={item.href}
                            prefetch={true}
                            aria-current={isActive ? "page" : undefined}
                            className={cn(
                               "group flex items-center rounded-2xl border px-3 py-2.5 transition-all duration-300 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35",
                              sidebarCollapsed ? "justify-center px-0" : "gap-3",
                              isActive
                                ? "border-shell-foreground/[0.08] bg-brand/10 text-brand-muted shadow-elevated"
                                : "border-transparent bg-transparent text-shell-foreground/30 hover:border-shell-foreground/[0.06] hover:bg-shell-foreground/[0.04] hover:text-shell-foreground/60",
                            )}
                          >
                            <item.Icon className={cn("h-5 w-5 shrink-0")} strokeWidth={isActive ? 2.9 : ICON_STROKE} />
                            {!sidebarCollapsed ? (
                              <span className="truncate text-sm font-black tracking-[-0.01em]">{item.label}</span>
                            ) : null}
                            {!sidebarCollapsed && showCount ? (
                              <span className="ml-auto">
                                <CountBadge active={isActive} count={unanswered} />
                              </span>
                            ) : null}
                          </Link>
                        </TooltipTrigger>
                        {sidebarCollapsed ? (
                          <TooltipContent side="right" sideOffset={12} className="font-semibold">
                            {item.label}
                            {showCount ? ` (${unanswered})` : ""}
                          </TooltipContent>
                        ) : null}
                      </Tooltip>
                    )
                  })}
                </nav>

                <div className="mt-8 rounded-2xl border border-shell-foreground/[0.08] bg-shell-foreground/[0.03] p-3 backdrop-blur-2xl">
                  <p
                    className={cn(
                      "mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-shell-foreground/30 transition-opacity duration-300",
                      sidebarCollapsed && "opacity-0",
                    )}
                  >
                    System
                  </p>
                  <JobHealthWidget compact={sidebarCollapsed} />
                </div>
              </ScrollArea>

              <div className="border-t border-shell-foreground/[0.08] p-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      className={cn(
                        "h-auto w-full rounded-2xl border border-transparent p-2 transition-all duration-300 hover:border-shell-foreground/[0.08] hover:bg-shell-foreground/[0.04]",
                        sidebarCollapsed ? "justify-center" : "flex items-center justify-start gap-3",
                      )}
                      aria-label="User menu"
                    >
                      <Avatar className="h-10 w-10 shrink-0 border border-shell-foreground/[0.12] shadow-sm">
                        <AvatarImage src={user.image ?? undefined} alt={user.name ?? "User"} />
                        <AvatarFallback className="bg-shell-foreground/[0.06] text-xs font-black text-shell-foreground/70">
                          {initials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      {!sidebarCollapsed ? (
                        <>
                          <div className="min-w-0 flex-1 text-left">
                            <p className="truncate text-sm font-black tracking-tight text-shell-foreground leading-none">
                              {user.name ?? "User"}
                            </p>
                            <p className="mt-1 truncate text-[11px] text-shell-foreground/40">{user.email ?? ""}</p>
                          </div>
                          <ChevronDown className="h-4 w-4 text-shell-foreground/30" strokeWidth={ICON_STROKE} />
                        </>
                      ) : null}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 rounded-2xl border-shell-foreground/[0.1] bg-shell-elevated/95 backdrop-blur-2xl">
                    <DropdownMenuItem
                      onSelect={() => signOut({ callbackUrl: "/signin" })}
                      className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                    >
                       <LogOut className="mr-2 size-4" strokeWidth={ICON_STROKE} />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </aside>

          {/* Tablet sidebar */}
          <aside className="relative z-20 hidden h-full w-[92px] p-3 md:flex lg:hidden">
            <div className="flex h-full w-full flex-col items-center rounded-[30px] border border-shell-foreground/[0.08] bg-shell-foreground/[0.03] py-4 shadow-floating backdrop-blur-2xl">
              <Link
                href="/inbox"
                aria-label="Go to inbox"
                className="brand-duo-gradient mb-5 grid h-11 w-11 place-items-center rounded-2xl text-brand-foreground shadow-glow-primary"
              >
                <Sparkles className="h-5 w-5" strokeWidth={ICON_STROKE} />
              </Link>
              <nav className="flex w-full flex-1 flex-col items-center gap-2 px-2" aria-label="Tablet navigation">
                {items.map((item) => {
                  const isActive = isNavItemActive(pathname, item.href)
                  const showCount = item.href === "/inbox" && unanswered > 0

                  return (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>
                        <Link
                          href={item.href}
                          prefetch={true}
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                             "relative grid h-11 w-11 place-items-center rounded-2xl border transition-all duration-300 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35",
                            isActive
                              ? "border-shell-foreground/[0.08] bg-brand/10 text-brand-muted shadow-elevated"
                              : "border-transparent bg-transparent text-shell-foreground/30 hover:border-shell-foreground/[0.06] hover:bg-shell-foreground/[0.04] hover:text-shell-foreground/60",
                          )}
                        >
                          <item.Icon className={cn("h-5 w-5")} strokeWidth={isActive ? 2.9 : ICON_STROKE} />
                          {showCount ? (
                            <span className="absolute -right-1 -top-1">
                              <CountBadge active={isActive} count={unanswered} />
                            </span>
                          ) : null}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  )
                })}
              </nav>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-3 h-11 w-11 rounded-2xl border border-shell-foreground/[0.08] bg-shell-foreground/[0.04] p-0"
                    aria-label="User menu"
                  >
                    <Avatar className="h-9 w-9 border border-shell-foreground/[0.12]">
                      <AvatarImage src={user.image ?? undefined} alt={user.name ?? "User"} />
                      <AvatarFallback className="bg-shell-foreground/[0.06] text-xs font-black text-shell-foreground/70">
                        {initials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-2xl border-shell-foreground/[0.1] bg-shell-elevated/95 backdrop-blur-2xl">
                  <DropdownMenuItem
                    onSelect={() => signOut({ callbackUrl: "/signin" })}
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                  >
                     <LogOut className="mr-2 size-4" strokeWidth={ICON_STROKE} />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </aside>

          {/* Main content area */}
          <main className="relative z-10 flex min-h-0 flex-1 flex-col p-2 pb-[5.5rem] md:p-3 md:pb-3">
            <header className="mb-2 flex h-14 shrink-0 items-center justify-between rounded-[24px] border border-shell-foreground/[0.08] bg-shell-foreground/[0.03] px-4 shadow-elevated backdrop-blur-2xl md:h-16 md:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-shell-foreground/30">Tahoe Engine v1.0</p>
                  <h1 className="truncate text-lg font-black tracking-[-0.03em] text-shell-foreground md:text-2xl">{viewLabel}</h1>
                </div>
                <div className="hidden h-8 w-px bg-shell-foreground/[0.1] md:block" />
                <div className="hidden items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-shell-foreground/30 md:flex">
                   <Globe className="h-3.5 w-3.5 text-brand-muted" strokeWidth={ICON_STROKE} />
                  Google Business Profile
                </div>
              </div>

              <div className="flex items-center gap-2 md:gap-2.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="relative h-10 w-10 rounded-2xl border border-shell-foreground/[0.08] bg-shell-foreground/[0.04] text-shell-foreground/50 transition-all duration-300 hover:bg-shell-foreground/[0.08] hover:text-shell-foreground/70"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" strokeWidth={ICON_STROKE} />
                  <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-shell/95" />
                </Button>

              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-hidden rounded-[26px] border border-shell-foreground/[0.08] bg-shell-foreground/[0.02] shadow-floating backdrop-blur-xl">
              <div className="h-full overflow-x-hidden overflow-y-auto">{children}</div>
            </div>
          </main>

          {/* Mobile bottom nav */}
          <nav
            className="fixed inset-x-3 bottom-3 z-50 flex h-[72px] items-center justify-around rounded-[30px] border-t border-shell-foreground/10 bg-shell/80 px-2 shadow-floating backdrop-blur-2xl md:hidden"
            aria-label="Mobile navigation"
          >
            {items.map((item) => {
              const isActive = isNavItemActive(pathname, item.href)
              const showCount = item.href === "/inbox" && unanswered > 0

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                     "relative flex h-full flex-1 flex-col items-center justify-center gap-1 rounded-2xl transition-all duration-300 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35",
                    isActive ? "bg-brand/10 text-brand-muted" : "text-shell-foreground/30",
                  )}
                >
                  <div className="relative">
                    <item.Icon className={cn("h-5 w-5")} strokeWidth={isActive ? 2.9 : ICON_STROKE} />
                    {showCount ? (
                      <span className="absolute -right-2 -top-2">
                        <CountBadge active={isActive} count={unanswered} />
                      </span>
                    ) : null}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.16em]">{item.shortLabel}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </TooltipProvider>
    </SearchProvider>
  )
}
