"use client"

import * as React from "react"
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const toggleGroupVariants = cva(
  "inline-flex items-center justify-center rounded-xl bg-muted p-1 text-muted-foreground",
  {
    variants: {
      size: {
        sm: "h-8",
        default: "h-9",
        lg: "h-10",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

export const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> &
    VariantProps<typeof toggleGroupVariants>
>(({ className, size, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={cn(toggleGroupVariants({ size }), className)}
    {...props}
  />
))
ToggleGroup.displayName = "ToggleGroup"

const toggleGroupItemVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-google-sm",
  {
    variants: {
      size: {
        sm: "h-7",
        default: "h-8",
        lg: "h-9",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

export const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> &
    VariantProps<typeof toggleGroupItemVariants>
>(({ className, size, ...props }, ref) => (
  <ToggleGroupPrimitive.Item
    ref={ref}
    className={cn(toggleGroupItemVariants({ size }), className)}
    {...props}
  />
))
ToggleGroupItem.displayName = "ToggleGroupItem"

