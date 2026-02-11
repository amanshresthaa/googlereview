"use client"

import * as React from "react"
import { Toaster as Sonner } from "sonner"
import { useTheme } from "next-themes"

export function Toaster() {
  const { theme } = useTheme()
  const resolved = theme === "dark" ? "dark" : "light"

  return (
    <Sonner
      theme={resolved}
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group toast bg-background text-foreground border border-border shadow-google-md",
          description: "text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-muted-foreground",
        },
      }}
    />
  )
}

