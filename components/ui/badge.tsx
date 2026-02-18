import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest transition-colors focus-ring",
  {
    variants: {
      variant: {
        default: "border-brand/35 bg-brand text-brand-foreground",
        secondary: "border-shell-foreground/10 bg-shell-foreground/5 text-shell-foreground/70",
        destructive: "border-destructive/35 bg-destructive text-destructive-foreground",
        outline: "border-shell-foreground/10 text-shell-foreground/85",
        success:
          "border-state-ready-border bg-state-ready-bg text-state-ready-fg",
        warning:
          "border-state-pending-border bg-state-pending-bg text-state-pending-fg",
        info:
          "border-state-posted-border bg-state-posted-bg text-state-posted-fg",
        pending:
          "border-state-needs-edit-border bg-state-needs-edit-bg text-state-needs-edit-fg",
        error:
          "border-state-error-border bg-state-error-bg text-state-error-fg",
        blocked:
          "border-state-blocked-border bg-state-blocked-bg text-state-blocked-fg",
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

export { badgeVariants }
