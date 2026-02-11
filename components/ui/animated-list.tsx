"use client"

import * as React from "react"
import { AnimatePresence, motion, type Variants } from "framer-motion"
import { cn } from "@/lib/utils"

const itemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 8,
    scale: 0.98,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 350,
      damping: 30,
      mass: 0.8,
    },
  },
  exit: {
    opacity: 0,
    y: -4,
    scale: 0.98,
    transition: {
      duration: 0.15,
    },
  },
}

interface AnimatedListProps<T> {
  items: T[]
  keyExtractor: (item: T, index: number) => string
  renderItem: (item: T, index: number) => React.ReactNode
  className?: string
  itemClassName?: string
  staggerDelay?: number
  emptyState?: React.ReactNode
  ariaLabel?: string
}

export function AnimatedList<T>({
  items,
  keyExtractor,
  renderItem,
  className,
  itemClassName,
  staggerDelay = 0.05,
  emptyState,
  ariaLabel = "Items list",
}: AnimatedListProps<T>) {
  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>
  }

  return (
    <div className={cn("space-y-3", className)} role="list" aria-label={ariaLabel}>
      <AnimatePresence mode="popLayout">
        {items.map((item, index) => (
          <motion.div
            key={keyExtractor(item, index)}
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            layout
            transition={{
              delay: index * staggerDelay,
            }}
            className={itemClassName}
            role="listitem"
          >
            {renderItem(item, index)}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

interface AnimatedContainerProps {
  children: React.ReactNode
  className?: string
  delay?: number
}

export function AnimatedContainer({ children, className, delay = 0 }: AnimatedContainerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{
        type: "spring",
        stiffness: 350,
        damping: 30,
        delay,
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

interface AnimatedNumberProps {
  value: number
  className?: string
  format?: (n: number) => string
}

export function AnimatedNumber({ value, className, format = (n) => n.toString() }: AnimatedNumberProps) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2 }}
      className={cn("tabular-nums", className)}
    >
      {format(value)}
    </motion.span>
  )
}
