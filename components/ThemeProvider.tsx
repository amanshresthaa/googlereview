"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}

/**
 * Re-export next-themes hook for convenience.
 * Returns { theme, setTheme, resolvedTheme, systemTheme }.
 */
export function useTheme() {
  return useNextTheme()
}
