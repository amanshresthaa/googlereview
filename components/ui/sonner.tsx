"use client"

import * as React from "react"
import { Toaster as Sonner } from "sonner"
import { useTheme } from "@/components/ThemeProvider"

export function Toaster() {
  const { resolvedTheme } = useTheme()

  return (
    <Sonner
      theme={(resolvedTheme as "light" | "dark") ?? "light"}
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group toast app-surface-shell border-shell-foreground/10 text-shell-foreground/90 shadow-google-md",
          description: "text-shell-foreground/70",
          actionButton: "border border-brand/35 bg-brand text-brand-foreground",
          cancelButton: "border border-shell-foreground/10 bg-shell-foreground/5 text-shell-foreground/70",
        },
      }}
    />
  )
}
