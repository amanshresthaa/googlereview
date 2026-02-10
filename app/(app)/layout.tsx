import { ReactNode } from "react"
import { AppSidebar } from "@/components/AppSidebar"
import { getSession } from "@/lib/session"
import { Toaster } from "@/components/ui/sonner"

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  const user = session?.user || { name: 'Guest', email: '', image: null }

  return (
    <div className="flex min-h-screen bg-stone-50 font-sans">
      <AppSidebar user={user} />
      <main className="flex-1 lg:ml-64 min-h-screen transition-all">
        {children}
      </main>
      <Toaster />
    </div>
  )
}
