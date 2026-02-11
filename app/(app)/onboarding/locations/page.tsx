import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import { LocationSelectorClient } from "@/app/(app)/onboarding/locations/location-selector-client"

export default async function OnboardingLocationsPage() {
  const session = await getSession()
  if (!session?.user?.id || !session.orgId) redirect("/signin")

  const locations = await prisma.location.findMany({
    where: { orgId: session.orgId },
    orderBy: { displayName: "asc" },
    select: {
      id: true,
      displayName: true,
      storeCode: true,
      addressSummary: true,
      enabled: true,
    },
  })

  return <LocationSelectorClient mode="onboarding" locations={locations} />
}

