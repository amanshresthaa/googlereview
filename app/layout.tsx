import type { Metadata, Viewport } from "next"
import { Noto_Sans } from "next/font/google"
import "@/app/globals.css"
import { cn } from "@/lib/utils"
import { Providers } from "@/components/Providers"

const notoSans = Noto_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
      className={cn(notoSans.variable, "font-sans")}
    >
      <body className="min-h-[100dvh] bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
