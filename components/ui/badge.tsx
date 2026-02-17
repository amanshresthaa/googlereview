import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest transition-colors focus:outline-none focus:ring-2 focus:ring-brand/30 focus:ring-offset-2 ring-offset-shell",
  {
    variants: {
      variant: {
        default: "border-brand/35 bg-brand text-brand-foreground",
        secondary: "border-shell-foreground/10 bg-shell-foreground/5 text-shell-foreground/70",
        destructive: "border-destructive/35 bg-destructive text-destructive-foreground",
        outline: "border-shell-foreground/10 text-shell-foreground/85",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export type BadgeProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
