"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2 ring-offset-shell disabled:pointer-events-none disabled:opacity-50 active:scale-95",
  {
    variants: {
      variant: {
        default: "border border-brand/35 bg-brand text-brand-foreground shadow-glow-primary hover:bg-brand-soft",
        secondary: "border border-shell-foreground/10 bg-shell-foreground/5 text-shell-foreground/85 hover:bg-shell-foreground/10",
        destructive: "border border-destructive/35 bg-destructive text-destructive-foreground shadow-lg shadow-destructive/20 hover:bg-destructive/90",
        outline: "border border-shell-foreground/10 bg-shell/40 text-shell-foreground/85 shadow-inner hover:bg-shell-foreground/10",
        ghost: "text-shell-foreground/75 hover:bg-shell-foreground/10 hover:text-shell-foreground/90",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { buttonVariants }
