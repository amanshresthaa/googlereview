"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, LayoutDashboard, MapPin, Settings, LogOut, Menu, X } from "lucide-react"
import { signOut } from "next-auth/react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

interface AppSidebarProps {
  user: { name?: string | null; email?: string | null; image?: string | null }
}

const NAV_ITEMS = [
  { label: "Inbox", icon: LayoutDashboard, href: "/inbox" },
  { label: "Locations", icon: MapPin, href: "/onboarding/locations" },
  { label: "Settings", icon: Settings, href: "/settings" },
]

function Logo() {
  return (
    <div className="flex items-center gap-3 px-2 mb-10">
      <div className="w-9 h-9 bg-emerald-700 rounded-full flex items-center justify-center">
        <Bell size={16} className="text-white" />
      </div>
      <span className="font-bold text-lg tracking-tight text-stone-900">LapenInns</span>
    </div>
  )
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="space-y-1 flex-grow">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isActive
                ? "bg-emerald-50 text-emerald-700"
                : "text-stone-500 hover:bg-stone-100 hover:text-stone-700"
            }`}
          >
            <item.icon size={18} />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

function UserSection({ user }: { user: AppSidebarProps["user"] }) {
  const initials = user.name
    ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "U"

  return (
    <div className="mt-auto border-t border-stone-200 pt-6">
      <div className="flex items-center gap-3 px-2 mb-4">
        <Avatar className="h-8 w-8">
          <AvatarImage src={user.image || undefined} />
          <AvatarFallback className="text-xs font-bold text-stone-500 bg-stone-100">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 overflow-hidden">
          <div className="text-xs font-bold truncate text-stone-900">{user.name || "User"}</div>
          <div className="text-[10px] text-stone-400 truncate font-medium">{user.email}</div>
        </div>
      </div>
      <Button
        variant="ghost"
        className="w-full justify-start gap-3 px-3 py-2 rounded-xl text-sm font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-700 h-auto"
        onClick={() => signOut({ callbackUrl: "/signin" })}
      >
        <LogOut size={18} />
        Sign Out
      </Button>
    </div>
  )
}

function SidebarContent({ pathname, user, onNavigate }: AppSidebarProps & { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      <Logo />
      <NavLinks pathname={pathname} onNavigate={onNavigate} />
      <UserSection user={user} />
    </>
  )
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 lg:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={22} />
      </Button>

      <aside
        role="navigation"
        aria-label="Main navigation"
        className="hidden lg:flex fixed left-0 top-0 h-full w-64 bg-white border-r border-stone-200 p-6 flex-col z-20"
      >
        <SidebarContent pathname={pathname} user={user} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside
            role="navigation"
            aria-label="Main navigation"
            className="absolute left-0 top-0 h-full w-64 bg-white p-6 flex flex-col shadow-xl animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <X size={18} />
            </Button>
            <SidebarContent pathname={pathname} user={user} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  )
}
