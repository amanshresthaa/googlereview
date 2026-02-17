import type { Metadata, Viewport } from "next"
import { Geist_Mono } from "next/font/google"
import "@/app/globals.css"
import { cn } from "@/lib/utils"
import { Providers } from "@/components/Providers"

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
})

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export const metadata: Metadata = {
  title: "GBP Reviews",
  description: "Google Business Profile Review Manager",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      dir="ltr"
      className={cn(geistMono.variable, "font-sans")}
    >
      <body className="min-h-[100dvh] bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
