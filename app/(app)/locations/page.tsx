import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { LocationSelectorClient } from "@/app/(app)/onboarding/locations/location-selector-client"
import { getLocationsSidebarData } from "@/lib/sidebar-data"

export default async function LocationsPage() {
  const session = await getSession()
  if (!session?.user?.id || !session.orgId) redirect("/signin")

  const locations = await getLocationsSidebarData(session.orgId)

  return <LocationSelectorClient mode="manage" locations={locations} />
}
