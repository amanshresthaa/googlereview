import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { ReviewPageClient } from "@/app/(app)/reviews/[id]/review-page-client"

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.user?.id || !session.orgId) redirect("/signin")

  const { id } = await params
  return <ReviewPageClient reviewId={id} />
}

