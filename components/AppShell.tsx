"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { signOut } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import { SearchProvider, useGlobalSearch } from "@/components/search-context"
import { JobHealthWidget } from "@/components/JobHealthWidget"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  Bell,
  LogOut,
  MessageSquare,
  MapPin,
  Settings,
  TrendingUp,
  Users,
  Moon,
  Sun,
  Laptop,
  Search,
  LayoutDashboard,
  X,
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
  Icon: React.ElementType
  badge?: number
}

/* ─── Unanswered review count polling ─── */
function useUnansweredCountPolling() {
  const [count, setCount] = React.useState<number | null>(null)

  React.useEffect(() => {
    let mounted = true
    let timer: ReturnType<typeof setInterval> | null = null

    const run = async () => {
      try {
        const res = await fetch("/api/reviews?filter=unanswered&limit=1")
        if (!mounted) return
        if (res.status === 401) { setCount(null); return }
        if (!res.ok) return
        const data = await res.json()
        const next = Number(data?.counts?.unanswered)
        if (Number.isFinite(next)) setCount(next)
      } catch { /* ignore */ }
    }

    void run()
    timer = setInterval(run, 20_000)
    return () => { mounted = false; if (timer) clearInterval(timer) }
  }, [])

  return count
}

/* ─── Helpers ─── */
function initials(name: string | null | undefined) {
  if (!name) return "U"
  const parts = name.trim().split(/\s+/)
  const a = parts[0]?.[0] ?? "?"
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : ""
  return (a + b).toUpperCase()
}

/* ─── Theme Menu ─── */
function ThemeMenuItems() {
  const { theme, setTheme } = useTheme()
  const current = theme ?? "system"

  const items = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Laptop },
  ] as const

  return (
    <>
      <DropdownMenuLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Theme</DropdownMenuLabel>
      {items.map(({ value, label, icon: Icon }) => (
        <DropdownMenuItem key={value} onClick={() => setTheme(value)} className="gap-2.5 px-3">
          <Icon className="size-4" />
          <span className="flex-1">{label}</span>
          {current === value && (
            <span className="size-1.5 rounded-full bg-primary" />
          )}
        </DropdownMenuItem>
      ))}
    </>
  )
}

/* ─── Mobile Top Bar ─── */
function MobileTopBar({ user }: { user: UserShape }) {
  const [searchOpen, setSearchOpen] = React.useState(false)
  const { query, setQuery } = useGlobalSearch()

  return (
    <header className="lg:hidden sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="flex items-center h-16 px-4 gap-2">
        {/* Logo */}
        <Link href="/inbox" className="flex items-center gap-3 shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-elevated">
            <MapPin className="size-5" />
          </div>
          <div className="text-base font-bold text-foreground tracking-tight">Reviews</div>
        </Link>

        <div className="flex-1" />

        {/* Search toggle */}
        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-muted-foreground" onClick={() => setSearchOpen(v => !v)}>
          {searchOpen ? <X className="size-5" /> : <Search className="size-5" />}
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl relative hidden md:flex text-muted-foreground">
          <Bell className="size-5" />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-background" />
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="outline-none rounded-xl focus-visible:ring-2 focus-visible:ring-ring/30">
              <div className="h-10 w-10 rounded-xl bg-muted text-muted-foreground flex items-center justify-center text-sm font-bold ring-1 ring-border/60">
                {initials(user.name)}
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl">
            <DropdownMenuLabel>
              <div className="space-y-0.5">
                <div className="text-sm font-bold truncate text-foreground">{user.name ?? "User"}</div>
                <div className="text-xs text-muted-foreground truncate">{user.email}</div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ThemeMenuItems />
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/signin" })} className="gap-2.5 text-destructive focus:text-destructive">
              <LogOut className="size-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile search bar */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 flex items-center gap-3 rounded-2xl bg-muted px-4 py-2.5 focus-within:bg-card focus-within:ring-2 focus-within:ring-ring/30 focus-within:shadow-sm transition-all border border-transparent focus-within:border-ring/40">
                <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search places, reviews..."
                  className="h-6 border-0 bg-transparent px-0 focus-visible:ring-0 text-sm placeholder:text-muted-foreground"
                  autoFocus
                />
                {query && (
                  <Button variant="ghost" size="icon" onClick={() => setQuery("")} className="h-5 w-5 rounded-full flex-shrink-0 hover:bg-accent">
                    <X className="h-3 w-3 text-muted-foreground" />
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

/* ─── Desktop Navigation Rail ─── */
function DesktopNavRail({
  items,
  unanswered,
  user,
}: {
  items: NavItem[]
  unanswered: number | null
  user: UserShape
}) {
  const pathname = usePathname()
  const { query, setQuery } = useGlobalSearch()

  return (
    <>
      {/* Rail */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[80px] border-r border-border bg-background/80 backdrop-blur-sm z-40">
        <div className="flex flex-col items-center w-full py-8 gap-6">
          {/* Logo */}
          <Link
            href="/inbox"
            className="h-12 w-12 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center shadow-elevated mb-4"
            aria-label="Home"
          >
            <MapPin className="size-6" />
          </Link>

          {/* Nav items */}
          <nav className="flex flex-col gap-4 w-full px-3">
            {items.map((it) => {
              const active = pathname === it.href || (it.href !== "/performance" && pathname.startsWith(it.href))
              const badge = it.href === "/inbox" && typeof unanswered === "number" ? unanswered : it.badge

              return (
                <Tooltip key={it.href} delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Link
                      href={it.href}
                      aria-label={it.label}
                      className={cn(
                        "h-12 w-12 rounded-2xl flex items-center justify-center transition-all mx-auto relative group outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                        active
                          ? "bg-card text-primary shadow-card ring-1 ring-border"
                          : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
                      )}
                    >
                      <it.Icon className="size-5" />

                      {/* Badge */}
                      {typeof badge === "number" && badge > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold grid place-items-center ring-2 ring-background">
                          {badge > 99 ? "99+" : badge}
                        </span>
                      )}

                      {/* Active indicator */}
                      {active && (
                        <motion.div
                          layoutId="nav-indicator"
                          className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 bg-primary rounded-r-full -ml-4"
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        />
                      )}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-medium text-xs bg-foreground text-background border-border">
                    {it.label}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </nav>

          {/* Bottom section */}
          <div className="mt-auto flex flex-col gap-4 items-center">
            {/* Job Health */}
            <div className="w-14 rounded-xl bg-muted/60 p-1.5">
              <JobHealthWidget compact />
            </div>

            {/* Notifications */}
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-xl relative text-muted-foreground hover:text-foreground hover:bg-card/60"
                  aria-label="Notifications"
                >
                  <Bell className="size-4" />
                  <span className="absolute top-2 right-2 size-1.5 rounded-full bg-rose-500 ring-2 ring-background" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs font-medium bg-foreground text-background border-border">
                Notifications
              </TooltipContent>
            </Tooltip>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="outline-none focus-visible:ring-2 focus-visible:ring-ring/30 rounded-full"
                  aria-label="User menu"
                >
                  <div className="h-10 w-10 rounded-full bg-muted ring-2 ring-background flex items-center justify-center text-sm font-bold text-muted-foreground shadow-sm cursor-pointer hover:ring-border transition-all">
                    {initials(user.name)}
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-56 rounded-xl">
                <DropdownMenuLabel>
                  <div className="space-y-0.5">
                    <div className="text-sm font-bold truncate text-foreground">{user.name ?? "User"}</div>
                    <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <ThemeMenuItems />
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="gap-2.5">
                    <Settings className="size-4" /> Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2.5 text-destructive focus:text-destructive"
                  onSelect={(e) => {
                    e.preventDefault()
                    signOut({ callbackUrl: "/signin" })
                  }}
                >
                  <LogOut className="size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Desktop floating search bar */}
      <div className="hidden lg:flex fixed top-4 left-[96px] right-8 z-30 justify-center pointer-events-none">
        <div className="w-full max-w-lg pointer-events-auto">
          <div className="flex items-center gap-3 rounded-2xl bg-card/95 backdrop-blur-xl px-4 py-2.5 shadow-elevated ring-1 ring-border/60 focus-within:ring-ring/30 focus-within:shadow-floating transition-all">
            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search reviews, locations…"
              aria-label="Search"
              className="h-6 border-0 bg-transparent px-0 focus-visible:ring-0 text-sm placeholder:text-muted-foreground"
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setQuery("")}
                className="h-5 w-5 rounded-full flex-shrink-0 hover:bg-accent"
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

/* ─── Bottom Navigation (Mobile) ─── */
function BottomNavigation({ items, unanswered }: { items: NavItem[]; unanswered: number | null }) {
  const pathname = usePathname()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-lg border-t border-border safe-area-bottom">
      <div className="grid grid-cols-5 h-[65px]">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== "/performance" && pathname.startsWith(item.href))
          const badge = item.href === "/inbox" && typeof unanswered === "number" ? unanswered : null

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 transition-all min-h-[44px] relative",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className={cn("p-1 rounded-xl transition-all", active && "bg-primary/10")}>
                <item.Icon className={cn("h-6 w-6 transition-all")} />
                {typeof badge === "number" && badge > 0 && (
                  <span className="absolute top-1 right-[calc(50%-8px)] min-w-3.5 h-3.5 px-0.5 rounded-full bg-rose-500 text-white text-[8px] font-bold grid place-items-center ring-1.5 ring-background translate-x-3">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </div>
              <span className={cn("text-[10px] font-bold transition-all", active ? "scale-105" : "scale-100")}>{item.label}</span>
              {active && (
                <motion.span
                  layoutId="mobile-nav-indicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

/* ─── Main Shell ─── */
export function AppShell({
  user,
  children,
}: {
  user: UserShape
  children: React.ReactNode
}) {
  const unanswered = useUnansweredCountPolling()

  const items: NavItem[] = [
    { href: "/performance", label: "Insights", Icon: TrendingUp },
    { href: "/inbox", label: "Reviews", Icon: MessageSquare },
    { href: "/locations", label: "Places", Icon: LayoutDashboard },
    { href: "/users", label: "Team", Icon: Users },
    { href: "/settings", label: "Settings", Icon: Settings },
  ]

  return (
    <SearchProvider>
      <TooltipProvider>
        <div className="h-screen w-full bg-background text-foreground overflow-hidden flex font-sans antialiased">
          <DesktopNavRail items={items} unanswered={unanswered} user={user} />

          <div className="flex-1 flex flex-col min-w-0 lg:pl-[80px]">
            <MobileTopBar user={user} />
            <main className="flex-1 relative pb-16 lg:pb-0 overflow-auto">
              {children}
            </main>
            <BottomNavigation items={items} unanswered={unanswered} />
          </div>
        </div>
      </TooltipProvider>
    </SearchProvider>
  )
}
