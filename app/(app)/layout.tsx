import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { AppShell } from "@/components/AppShell"

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  if (!session?.user?.id || !session.orgId) redirect("/signin")

  return (
    <AppShell
      user={{
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
        role: session.role ?? "",
      }}
    >
      {children}
    </AppShell>
  )
}

