import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { ReviewDeepLink } from "@/app/(app)/reviews/[id]/ReviewDeepLink"

export default async function ReviewDetailPage(ctx: {
  params: Promise<{ id: string }>
}) {
  const session = await getSession()
  if (!session?.user?.id || !session.orgId) redirect("/signin")
  const { id } = await ctx.params
  return <ReviewDeepLink reviewId={id} />
}
