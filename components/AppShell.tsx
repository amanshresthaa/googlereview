"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { SearchProvider } from "@/components/search-context"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Globe,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Sparkles,
  Users,
  BarChart,
  LogOut,
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
  mobileLabel: string
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
  if (pathname.startsWith("/performance")) return "Insights"
  if (pathname.startsWith("/locations")) return "Locations"
  if (pathname.startsWith("/users")) return "Team"
  if (pathname.startsWith("/settings")) return "Settings"
  return "Inbox"
}

function initials(name: string | null | undefined) {
  if (!name) return "U"
  const parts = name.trim().split(/\s+/)
  const a = parts[0]?.[0] ?? "U"
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : ""
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
    { href: "/inbox", label: "Inbox", mobileLabel: "Inbox", Icon: MessageSquare },
    { href: "/performance", label: "Insights", mobileLabel: "Insights", Icon: BarChart },
    { href: "/locations", label: "Locations", mobileLabel: "Places", Icon: LayoutDashboard },
    { href: "/users", label: "Team", mobileLabel: "Team", Icon: Users },
    { href: "/settings", label: "Settings", mobileLabel: "Settings", Icon: Settings },
  ]

  return (
    <SearchProvider>
      <div className="flex h-screen w-full bg-[#f9fafb] text-zinc-900 overflow-hidden">
        <aside
          className={cn(
            "hidden lg:flex border-r border-zinc-200 bg-white flex-col shrink-0 transition-[width] duration-200",
            sidebarCollapsed ? "w-20" : "w-64"
          )}
        >
          <div className="p-6 border-b border-zinc-200">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="bg-blue-600 p-1.5 rounded-lg">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                {!sidebarCollapsed ? <span className="text-xl font-bold tracking-tight text-zinc-900">ReplyAI</span> : null}
              </div>
              {!sidebarCollapsed ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-zinc-500 hover:text-zinc-700"
                  onClick={() => setSidebarCollapsed(true)}
                  aria-label="Collapse sidebar"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-zinc-500 hover:text-zinc-700"
                  onClick={() => setSidebarCollapsed(false)}
                  aria-label="Expand sidebar"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
            {!sidebarCollapsed ? (
              <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Business Inbox</p>
            ) : null}
          </div>

          <ScrollArea className="flex-1 p-4">
            <nav className="space-y-1">
              {items.map((item) => {
                const active = isNavItemActive(pathname, item.href)
                const count = item.href === "/inbox" ? unanswered : 0
                return (
                  <Button
                    key={item.href}
                    asChild
                    variant="ghost"
                    className={cn(
                      "w-full h-auto rounded-lg transition-all relative group",
                      sidebarCollapsed ? "px-2 py-2.5 justify-center" : "px-3 py-2.5 justify-start",
                      active ? "bg-blue-50 text-blue-700 shadow-sm hover:bg-blue-50" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
                    )}
                  >
                    <Link href={item.href} className={cn("flex w-full items-center", sidebarCollapsed ? "justify-center" : "gap-3")}>
                      <item.Icon className={cn("h-5 w-5", active ? "text-blue-600" : "text-zinc-400 group-hover:text-zinc-600")} />
                      {!sidebarCollapsed ? <span className="text-sm font-semibold flex-1 text-left">{item.label}</span> : null}
                      {count > 0 && !sidebarCollapsed ? (
                        <Badge className="bg-blue-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-md min-w-[20px] text-center border-transparent">
                          {count > 99 ? "99+" : count}
                        </Badge>
                      ) : null}
                      {count > 0 && sidebarCollapsed ? (
                        <Badge className="absolute -top-0.5 right-1 h-2.5 w-2.5 rounded-full bg-blue-600 border-transparent p-0" />
                      ) : null}
                      {active && !sidebarCollapsed ? <div className="absolute left-0 top-2 bottom-2 w-1 bg-blue-600 rounded-full" /> : null}
                    </Link>
                  </Button>
                )
              })}
            </nav>
          </ScrollArea>

          <div className="p-4 border-t border-zinc-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(
                    "w-full p-2 rounded-lg hover:bg-zinc-50 transition-colors h-auto",
                    sidebarCollapsed ? "justify-center" : "flex items-center gap-3 justify-start"
                  )}
                >
                  <Avatar className="h-8 w-8 border border-blue-100">
                    <AvatarImage src={user.image ?? undefined} alt={user.name ?? "User"} />
                    <AvatarFallback className="bg-blue-100 text-blue-700 font-bold text-xs">
                      {initials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  {!sidebarCollapsed ? (
                    <>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium text-zinc-900 truncate">{user.name ?? "User"}</p>
                        <p className="text-xs text-zinc-500 truncate">{user.email ?? "No email"}</p>
                      </div>
                      <ChevronDown className="h-4 w-4 text-zinc-400" />
                    </>
                  ) : null}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onSelect={() => signOut({ callbackUrl: "/signin" })}
                  className="cursor-pointer"
                >
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>

        <main className="flex-1 flex flex-col relative overflow-hidden">
          <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-6 shrink-0 z-10">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-zinc-900 capitalize">{viewLabel}</h2>
              <Separator orientation="vertical" className="h-4 bg-zinc-200" />
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Globe className="h-4 w-4" />
                <span>Google Business Profile</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {pathname.startsWith("/inbox") && unanswered > 0 ? (
                <Button
                  type="button"
                  onClick={() => window.dispatchEvent(new Event("replyai:open-blitz"))}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Quick Reply</span>
                </Button>
              ) : null}
              <Button type="button" variant="ghost" size="icon" className="p-2 text-zinc-400 hover:text-zinc-600 relative h-9 w-9">
                <Bell className="h-5 w-5" />
                <div className="absolute top-2 right-2 h-2 w-2 bg-red-500 border-2 border-white rounded-full" />
              </Button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto">{children}</div>

          <div className="lg:hidden h-16 bg-white border-t border-zinc-200 flex items-center justify-around px-2 shrink-0">
            {items.map((item) => {
              const active = isNavItemActive(pathname, item.href)
              return (
                <Button
                  key={item.href}
                  asChild
                  variant="ghost"
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 flex-1 h-full rounded-none",
                    active ? "text-blue-600 hover:text-blue-600" : "text-zinc-400"
                  )}
                >
                  <Link href={item.href}>
                    <item.Icon className="h-5 w-5" />
                    <span className="text-[10px] font-bold uppercase tracking-tight">{item.mobileLabel}</span>
                  </Link>
                </Button>
              )
            })}
          </div>
        </main>
      </div>
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
  return (
    <Badge className={cn("bg-zinc-900 text-white", className)}>{children}</Badge>
  )
}
