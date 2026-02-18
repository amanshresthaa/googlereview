import type { Metadata } from "next"
import { Toaster } from "sonner"

import "./globals.css"

export const metadata: Metadata = {
  title: "GBP Reviews",
  description: "Operational inbox for Google Business Profile reviews.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-shell text-shell-foreground antialiased">
        {children}
        <Toaster richColors closeButton />
      </body>
    </html>
  )
}
