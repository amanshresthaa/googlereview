"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "@/components/icons"
import { ReviewDetail } from "@/components/ReviewDetail"

export function ReviewPageClient({ reviewId }: { reviewId: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="h-full flex flex-col"
    >
      <div className="p-6 border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-20">
        <Link href="/inbox">
          <Button variant="ghost" type="button" className="gap-2.5 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-accent h-9">
            <ArrowLeft className="size-4" />
            Back to Inbox
          </Button>
        </Link>
      </div>
      <div className="flex-1 overflow-hidden">
        <ReviewDetail reviewId={reviewId} />
      </div>
    </motion.div>
  )
}
