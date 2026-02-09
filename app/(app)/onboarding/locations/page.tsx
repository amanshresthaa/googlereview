import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
    <div className="mx-auto max-w-2xl space-y-6 p-6 animate-fade-in overflow-y-auto h-full">
      <Link
        href="/inbox"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        Back to inbox
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Locations</CardTitle>
          <CardDescription>
            Select which Google Business Profile locations to manage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Connected: <span className="text-foreground font-medium">{conn?.googleEmail ?? "None"}</span>
            {conn?.status ? (
              <Badge variant={conn.status === "REAUTH_REQUIRED" ? "destructive" : "secondary"} className="ml-2">
                {conn.status}
              </Badge>
            ) : null}
          </div>
          {conn?.status === "REAUTH_REQUIRED" ? (
            <p className="text-destructive text-sm">
              Google connection needs reconnect. Sign out and sign in again.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <LocationSelectorClient locations={locations} />
    </div>
  )
}
