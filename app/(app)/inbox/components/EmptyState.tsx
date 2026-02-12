import * as React from "react"
import { motion } from "framer-motion"

type EmptyStateProps = {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center"
    >
      <div className="relative mb-6">
        <motion.div
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-3xl bg-primary/5 blur-2xl"
        />
        <div className="relative grid h-20 w-20 place-items-center rounded-3xl border border-border/50 bg-background shadow-card transition-transform duration-500 hover:scale-110">
          <Icon className="h-9 w-9 text-primary/60" />
        </div>
      </div>
      <h3 className="text-xl font-bold tracking-tight text-foreground">{title}</h3>
      <p className="mt-2 max-w-sm text-sm font-medium leading-relaxed text-muted-foreground">
        {description}
      </p>
    </motion.div>
  )
}


