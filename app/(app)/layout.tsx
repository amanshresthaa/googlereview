import { ReactNode } from "react"
import { AppNav } from "@/components/AppNav"

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <AppNav />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
