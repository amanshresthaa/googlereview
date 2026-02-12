"use client"

import * as React from "react"
import { AnimatePresence } from "framer-motion"
import { ThemeProvider } from "@/components/ThemeProvider"
import { Toaster } from "@/components/ui/sonner"
import { DirectionProvider } from "@/components/ui/direction"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <DirectionProvider dir="ltr">
        <AnimatePresence mode="wait">
          {children}
        </AnimatePresence>
        <Toaster />
      </DirectionProvider>
    </ThemeProvider>
  )
}
