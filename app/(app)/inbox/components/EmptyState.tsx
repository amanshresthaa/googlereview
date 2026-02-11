import type * as React from "react"

type EmptyStateProps = {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center py-20 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-border/50 bg-muted/30">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
