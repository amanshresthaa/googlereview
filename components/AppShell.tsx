"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { useTheme } from "next-themes"
import { SearchProvider } from "@/components/search-context"
import { cn } from "@/lib/utils"
import { REPLYAI_UNANSWERED_COUNT_EVENT } from "@/lib/reviews/count-events"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Globe,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Moon,
  Settings,
  Sparkles,
  Sun,
  BarChart,
} from "@/components/icons"
import { JobHealthWidget } from "./JobHealthWidget"

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
  const [mounted, setMounted] = React.useState(false)
  const { theme, setTheme } = useTheme()

  React.useEffect(() => {
    setMounted(true)
  }, [])

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

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  return (
    <SearchProvider>
      <TooltipProvider delayDuration={300}>
        <div className="flex h-[100dvh] min-h-[100dvh] w-full overflow-hidden bg-background text-foreground">
          <aside
            className={cn(
              "hidden shrink-0 flex-col border-r border-border bg-card transition-[width] duration-300 lg:flex",
              sidebarCollapsed ? "w-[72px]" : "w-64",
            )}
          >
            <div className="border-b border-border p-4">
              <div className="flex items-center justify-between">
                <Link
                  href="/inbox"
                  className={cn("flex items-center", sidebarCollapsed ? "gap-0" : "gap-2.5")}
                  aria-label="Go to inbox"
                >
                  <div className="rounded-xl bg-primary p-2 shadow-glow-primary">
                    <Sparkles className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <span
                    className={cn(
                      "overflow-hidden whitespace-nowrap text-lg font-bold tracking-tight text-foreground transition-all duration-300",
                      sidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100",
                    )}
                  >
                    ReplyAI
                  </span>
                </Link>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                      aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                      className="h-8 w-8 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    >
                      {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{sidebarCollapsed ? "Expand" : "Collapse"}</TooltipContent>
                </Tooltip>
              </div>
            </div>

            <ScrollArea className="flex-1 px-3 py-4">
              <nav className="space-y-1.5" aria-label="Main navigation">
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
                            "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                            sidebarCollapsed && "justify-center px-0",
                            isActive
                              ? "bg-primary text-primary-foreground shadow-glow-primary"
                              : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                          )}
                        >
                          <item.Icon
                            className={cn(
                              "h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-110",
                              isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground",
                            )}
                          />
                          {!sidebarCollapsed ? <span className="truncate">{item.label}</span> : null}
                          {showCount && !sidebarCollapsed ? (
                            <Badge className={cn(
                              "ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                              isActive ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground"
                            )}>
                              {unanswered > 99 ? "99+" : unanswered}
                            </Badge>
                          ) : null}
                        </Link>
                      </TooltipTrigger>
                      {sidebarCollapsed ? (
                        <TooltipContent side="right" sideOffset={10} className="font-semibold">
                          {item.label}
                          {showCount ? ` (${unanswered})` : ""}
                        </TooltipContent>
                      ) : null}
                    </Tooltip>
                  )
                })}
              </nav>

              <div className="mt-8 space-y-4">
                <div className={cn(
                  "px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 transition-opacity duration-300",
                  sidebarCollapsed ? "opacity-0" : "opacity-100"
                )}>
                  System
                </div>
                <JobHealthWidget compact={sidebarCollapsed} />
              </div>
            </ScrollArea>

            <div className="border-t border-border p-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn(
                      "h-auto w-full rounded-xl p-2 transition-all hover:bg-muted/80",
                      sidebarCollapsed ? "justify-center" : "flex items-center justify-start gap-3",
                    )}
                    aria-label="User menu"
                  >
                    <Avatar className="h-9 w-9 shrink-0 border border-border shadow-sm">
                      <AvatarImage src={user.image ?? undefined} alt={user.name ?? "User"} />
                      <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                        {initials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    {!sidebarCollapsed ? (
                      <>
                        <div className="min-w-0 flex-1 text-left">
                          <p className="truncate text-sm font-semibold text-foreground leading-none">{user.name ?? "User"}</p>
                          <p className="mt-1 truncate text-[11px] text-muted-foreground">{user.email ?? ""}</p>
                        </div>
                        <ChevronDown className="h-4 w-4 text-muted-foreground/50" />
                      </>
                    ) : null}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl">
                  <DropdownMenuItem onSelect={toggleTheme}>
                    {mounted && theme === "dark" ? (
                      <>
                        <Sun className="mr-2 size-4" />
                        Light mode
                      </>
                    ) : (
                      <>
                        <Moon className="mr-2 size-4" />
                        Dark mode
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => signOut({ callbackUrl: "/signin" })}
                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                  >
                    <LogOut className="mr-2 size-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </aside>

          <main className="relative flex flex-1 flex-col overflow-hidden">
            <header className="z-10 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/80 glass-sm px-4 md:h-16 md:px-6">
              <div className="flex items-center gap-3 md:gap-4">
                <h1 className="text-base font-bold tracking-tight text-foreground md:text-xl">{viewLabel}</h1>
                <Separator orientation="vertical" className="hidden h-5 bg-border md:block" />
                <div className="hidden items-center gap-2 text-sm font-medium text-muted-foreground md:flex">
                  <Globe className="h-4 w-4 text-primary/60" />
                  <span>Google Business Profile</span>
                </div>
              </div>

              <div className="flex items-center gap-2 md:gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="relative h-10 w-10 rounded-full text-muted-foreground hover:bg-muted/80 hover:text-foreground md:h-9 md:w-9"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive shadow-[0_0_0_2px_white] dark:shadow-[0_0_0_2px_black]" />
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  className="h-9 w-9 rounded-full text-muted-foreground hover:bg-muted/80 hover:text-foreground lg:hidden"
                  aria-label="Toggle theme"
                >
                  {mounted && theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </Button>
              </div>
            </header>

            <div className="flex-1 overflow-x-hidden overflow-y-auto bg-zinc-50/50 dark:bg-zinc-950/20">{children}</div>

            <nav
              className="flex h-16 shrink-0 items-center justify-around border-t border-border bg-background/80 glass px-2 pb-[env(safe-area-inset-bottom)] lg:hidden"
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
                      "relative flex h-full flex-1 flex-col items-center justify-center gap-1 transition-all duration-200",
                      isActive ? "text-primary scale-110" : "text-muted-foreground",
                    )}
                  >
                    <div className="relative">
                      <item.Icon className={cn("h-5 w-5", isActive && "stroke-[2.5px]")} />
                      {showCount ? (
                        <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-black text-primary-foreground shadow-sm">
                          {unanswered > 99 ? "99+" : unanswered}
                        </span>
                      ) : null}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest">{item.shortLabel}</span>
                  </Link>
                )
              })}
            </nav>
          </main>
        </div>
      </TooltipProvider>
    </SearchProvider>
  )
}


export function ShellBadge({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <Badge className={cn("bg-foreground text-background", className)}>{children}</Badge>
}
