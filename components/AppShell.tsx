"use client"

import * as React from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { useTheme } from "next-themes"
import { SearchProvider } from "@/components/search-context"
import { cn } from "@/lib/utils"
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
} from "@/components/icons"

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
  const pollEnabled = pathname.startsWith("/inbox")
  const [isVisible, setIsVisible] = React.useState(() => {
    if (typeof document === "undefined") return true
    return document.visibilityState === "visible"
  })

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
        const res = await fetch("/api/reviews/unanswered-count", {
          signal: inflightController.signal,
          cache: "no-store",
        })
        if (!mounted || !res.ok) return
        const data = await res.json()
        const next = Number(data?.count)
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

    timer = setInterval(run, 20_000)
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
  ]

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  return (
    <SearchProvider>
      <TooltipProvider delayDuration={300}>
        <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
          <aside
            className={cn(
              "hidden shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 lg:flex",
              sidebarCollapsed ? "w-[72px]" : "w-64",
            )}
          >
            <div className="border-b border-border p-4">
              <div className="flex items-center justify-between">
                <Link href="/inbox" className="flex items-center gap-2" aria-label="Go to inbox">
                  <div className="rounded-lg bg-primary p-1.5">
                    <Sparkles className="h-5 w-5 text-primary-foreground" />
                  </div>
                  {!sidebarCollapsed ? (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      className="overflow-hidden whitespace-nowrap text-lg font-bold tracking-tight text-foreground"
                    >
                      ReplyAI
                    </motion.span>
                  ) : null}
                </Link>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                      aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    >
                      {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{sidebarCollapsed ? "Expand" : "Collapse"}</TooltipContent>
                </Tooltip>
              </div>
            </div>

            <ScrollArea className="flex-1 p-3">
              <nav className="space-y-1" aria-label="Main navigation">
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
                            "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                            sidebarCollapsed && "justify-center px-2",
                            isActive
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                        >
                          <item.Icon
                            className={cn(
                              "h-5 w-5 shrink-0",
                              isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                            )}
                          />
                          {!sidebarCollapsed ? <span className="truncate">{item.label}</span> : null}
                          {showCount && !sidebarCollapsed ? (
                            <Badge className="ml-auto rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                              {unanswered > 99 ? "99+" : unanswered}
                            </Badge>
                          ) : null}
                          {isActive && !sidebarCollapsed ? (
                            <motion.div
                              layoutId="activeIndicator"
                              className="absolute bottom-1 left-0 top-1 w-1 rounded-r-full bg-primary"
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          ) : null}
                        </Link>
                      </TooltipTrigger>
                      {sidebarCollapsed ? (
                        <TooltipContent side="right">
                          {item.label}
                          {showCount ? ` (${unanswered})` : ""}
                        </TooltipContent>
                      ) : null}
                    </Tooltip>
                  )
                })}
              </nav>
            </ScrollArea>

            <div className="border-t border-border p-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn(
                      "h-auto w-full rounded-lg p-2 transition-colors hover:bg-muted",
                      sidebarCollapsed ? "justify-center" : "flex items-center justify-start gap-3",
                    )}
                    aria-label="User menu"
                  >
                    <Avatar className="h-8 w-8 shrink-0 border border-border">
                      <AvatarImage src={user.image ?? undefined} alt={user.name ?? "User"} />
                      <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                        {initials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    {!sidebarCollapsed ? (
                      <>
                        <div className="min-w-0 flex-1 text-left">
                          <p className="truncate text-sm font-medium text-foreground">{user.name ?? "User"}</p>
                          <p className="truncate text-xs text-muted-foreground">{user.email ?? ""}</p>
                        </div>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </>
                    ) : null}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
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
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 size-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </aside>

          <main className="relative flex flex-1 flex-col overflow-hidden">
            <header className="z-10 flex h-12 shrink-0 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur-sm md:h-16 md:px-6">
              <div className="flex items-center gap-3 md:gap-4">
                <h1 className="text-base font-semibold capitalize text-foreground md:text-lg">{viewLabel}</h1>
                <Separator orientation="vertical" className="hidden h-4 bg-border md:block" />
                <div className="hidden items-center gap-2 text-sm text-muted-foreground md:flex">
                  <Globe className="h-4 w-4" />
                  <span>Google Business Profile</span>
                </div>
              </div>

              <div className="flex items-center gap-2 md:gap-3">
                {pathname.startsWith("/inbox") && unanswered > 0 ? (
                  <Button
                    type="button"
                    onClick={() => window.dispatchEvent(new Event("replyai:open-blitz"))}
                    className="hidden items-center gap-2 bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 md:flex"
                  >
                    <Sparkles className="h-4 w-4" />
                    Quick Reply
                  </Button>
                ) : null}

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="relative h-10 w-10 text-muted-foreground hover:text-foreground md:h-9 md:w-9"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  className="h-9 w-9 text-muted-foreground hover:text-foreground lg:hidden"
                  aria-label="Toggle theme"
                >
                  {mounted && theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </Button>
              </div>
            </header>

            <div className="flex-1 overflow-x-hidden overflow-y-auto">{children}</div>

            <nav
              className="flex h-14 shrink-0 items-center justify-around border-t border-border bg-card px-2 pb-[env(safe-area-inset-bottom)] lg:hidden"
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
                      "relative flex h-full flex-1 flex-col items-center justify-center gap-1 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    <div className="relative">
                      <item.Icon className="h-5 w-5" />
                      {showCount ? (
                        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                          {unanswered > 99 ? "99+" : unanswered}
                        </span>
                      ) : null}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-tight">{item.shortLabel}</span>
                    {isActive ? (
                      <motion.div
                        layoutId="mobileActiveIndicator"
                        className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-primary"
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    ) : null}
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
