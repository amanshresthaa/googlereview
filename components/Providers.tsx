"use client"

import * as React from "react"
import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "@/components/ThemeProvider"
import { Toaster } from "@/components/ui/sonner"
import { DirectionProvider } from "@/components/ui/direction"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <DirectionProvider dir="ltr">
          {children}
          <Toaster />
        </DirectionProvider>
      </ThemeProvider>
    </SessionProvider>
  )
}
