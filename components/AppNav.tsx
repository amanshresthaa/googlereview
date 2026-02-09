import Link from "next/link"
import { SignOutButton } from "@/components/SignOutButton"

export function AppNav() {
  return (
    <header className="border-border/60 bg-background/70 sticky top-0 z-30 border-b backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/inbox" className="text-sm font-semibold tracking-tight">
            GBP Reply Inbox
          </Link>
          <nav className="text-muted-foreground flex items-center gap-3 text-sm">
            <Link href="/inbox" className="hover:text-foreground">
              Inbox
            </Link>
            <Link href="/settings" className="hover:text-foreground">
              Settings
            </Link>
          </nav>
        </div>
        <SignOutButton />
      </div>
    </header>
  )
}

