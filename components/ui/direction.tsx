"use client"

import * as React from "react"
import * as DirectionPrimitive from "@radix-ui/react-direction"

export function DirectionProvider({
  dir,
  children,
}: {
  dir: "ltr" | "rtl"
  children: React.ReactNode
}) {
  return <DirectionPrimitive.DirectionProvider dir={dir}>{children}</DirectionPrimitive.DirectionProvider>
}

