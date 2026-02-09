import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LocationSelectorClient } from "@/app/(app)/onboarding/locations/LocationSelectorClient"

export default async function LocationSelectorPage() {
  const session = await getSession()
  if (!session?.user?.id || !session.orgId) redirect("/signin")

  const conn = await prisma.googleConnection.findUnique({
    where: { orgId: session.orgId },
    select: { status: true, googleEmail: true },
  })

  const locations = await prisma.location.findMany({
    where: { orgId: session.orgId },
    orderBy: [{ enabled: "desc" }, { displayName: "asc" }],
    select: {
      id: true,
      displayName: true,
      addressSummary: true,
      storeCode: true,
      enabled: true,
    },
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Select locations</CardTitle>
          <CardDescription>
            Choose the Google Business Profile locations you want to manage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-muted-foreground text-sm">
            Connected account:{" "}
            <span className="text-foreground font-medium">
              {conn?.googleEmail ?? "Not connected"}
            </span>{" "}
            ({conn?.status ?? "—"})
          </div>
          {conn?.status === "REAUTH_REQUIRED" ? (
            <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border p-3 text-sm">
              Google connection needs reconnect. Sign out and sign in again to grant offline access.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <LocationSelectorClient locations={locations} />
    </div>
  )
}

