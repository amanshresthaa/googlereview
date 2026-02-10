"use client"

import { motion } from "framer-motion"
import { ReviewDetail } from "@/components/ReviewDetail"

export function ReviewPageClient({ reviewId }: { reviewId: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="h-full flex flex-col bg-background"
    >
      <div className="flex-1 overflow-hidden">
        <ReviewDetail reviewId={reviewId} backHref="/inbox" />
      </div>
    </motion.div>
  )
}
