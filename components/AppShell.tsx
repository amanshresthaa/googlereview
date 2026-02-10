"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { SearchProvider } from "@/components/search-context"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Bell,
  ChevronDown,
  Globe,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Sparkles,
  Users,
  BarChart,
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

function isNavItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function useUnansweredCountPolling() {
  const [count, setCount] = React.useState<number>(0)
  const pathname = usePathname()
  const pollEnabled = pathname.startsWith("/inbox")

  React.useEffect(() => {
    if (!pollEnabled) return

    let mounted = true
    let timer: ReturnType<typeof setInterval> | null = null

    const run = async () => {
      try {
        const res = await fetch("/api/reviews/unanswered-count")
        if (!mounted || !res.ok) return
        const data = await res.json()
        const next = Number(data?.count)
        if (Number.isFinite(next)) setCount(next)
      } catch {
        // ignore polling failures
      }
    }

    void run()
    timer = setInterval(run, 20_000)
    return () => {
      mounted = false
      if (timer) clearInterval(timer)
    }
  }, [pollEnabled])

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
        <aside className="hidden lg:flex w-64 border-r border-zinc-200 bg-white flex-col shrink-0">
          <div className="p-6 border-b border-zinc-200">
            <div className="flex items-center gap-2 mb-1">
              <div className="bg-blue-600 p-1.5 rounded-lg">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-zinc-900">ReplyAI</span>
            </div>
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Business Inbox</p>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {items.map((item) => {
              const active = isNavItemActive(pathname, item.href)
              const count = item.href === "/inbox" ? unanswered : 0
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all relative group",
                    active ? "bg-blue-50 text-blue-700 shadow-sm" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
                  )}
                >
                  <item.Icon className={cn("h-5 w-5", active ? "text-blue-600" : "text-zinc-400 group-hover:text-zinc-600")} />
                  <span className="text-sm font-semibold flex-1 text-left">{item.label}</span>
                  {count > 0 ? (
                    <span className="bg-blue-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-md min-w-[20px] text-center">
                      {count > 99 ? "99+" : count}
                    </span>
                  ) : null}
                  {active ? <div className="absolute left-0 top-2 bottom-2 w-1 bg-blue-600 rounded-full" /> : null}
                </Link>
              )
            })}
          </nav>

          <div className="p-4 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/signin" })}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-50 transition-colors"
            >
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.image} alt={user.name ?? "User"} className="h-full w-full rounded-full object-cover" />
                ) : (
                  initials(user.name)
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-zinc-900 truncate">{user.name ?? "User"}</p>
                <p className="text-xs text-zinc-500 truncate">{user.email ?? "No email"}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-zinc-400" />
            </button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col relative overflow-hidden">
          <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-6 shrink-0 z-10">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-zinc-900 capitalize">{viewLabel}</h2>
              <div className="h-4 w-px bg-zinc-200" />
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
              <button type="button" className="p-2 text-zinc-400 hover:text-zinc-600 relative">
                <Bell className="h-5 w-5" />
                <div className="absolute top-2 right-2 h-2 w-2 bg-red-500 border-2 border-white rounded-full" />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto">{children}</div>

          <div className="lg:hidden h-16 bg-white border-t border-zinc-200 flex items-center justify-around px-2 shrink-0">
            {items.map((item) => {
              const active = isNavItemActive(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 flex-1 h-full",
                    active ? "text-blue-600" : "text-zinc-400"
                  )}
                >
                  <item.Icon className="h-5 w-5" />
                  <span className="text-[10px] font-bold uppercase tracking-tight">{item.mobileLabel}</span>
                </Link>
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
