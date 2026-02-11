import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/db"

export default async function Page() {
  const session = await getSession()
  if (!session?.user?.id || !session.orgId) redirect("/signin")

  const hasEnabledLocation = await prisma.location.findFirst({
    where: { orgId: session.orgId, enabled: true },
    select: { id: true },
  })

  if (!hasEnabledLocation) redirect("/onboarding/locations")
  redirect("/inbox")
}

