import Link from "next/link"
import { Inbox, Settings } from "lucide-react"
import { SignOutButton } from "@/components/SignOutButton"

export function AppNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="mx-auto flex h-12 w-full max-w-screen-2xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/inbox" className="text-sm font-semibold tracking-tight">
            LapenInns
          </Link>
          <nav className="flex items-center gap-1">
            <Link
              href="/inbox"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <Inbox className="size-3.5" />
              Inbox
            </Link>
            <Link
              href="/settings"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <Settings className="size-3.5" />
              Settings
            </Link>
          </nav>
        </div>
        <SignOutButton />
      </div>
    </header>
  )
}
