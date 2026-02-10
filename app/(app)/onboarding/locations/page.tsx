import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/db"
import { Badge } from "@/components/ui/badge"
import { MapPin, AlertTriangle } from "lucide-react"
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

  const hasSynced = locations.length > 0
  const hasEnabled = locations.some((l) => l.enabled)
  const isReauth = conn?.status === "REAUTH_REQUIRED"

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6 animate-fade-in overflow-y-auto h-full">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 mb-2">
          <MapPin className="size-6" />
        </div>
        <h1 className="text-2xl font-bold text-stone-900">Set Up Your Locations</h1>
        <p className="text-stone-500 text-sm">
          Connect and choose which properties to manage reviews for.
        </p>
      </div>

      <div className="flex items-center justify-center gap-0">
        <div className="flex flex-col items-center gap-1.5">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold border-2 ${
              hasSynced
                ? "bg-emerald-600 border-emerald-600 text-white"
                : "border-stone-300 text-stone-400 bg-white"
            }`}
          >
            1
          </div>
          <span className="text-xs text-stone-500 font-medium">Sync Locations</span>
        </div>
        <div
          className={`w-20 h-0.5 mb-5 ${hasSynced ? "bg-emerald-600" : "bg-stone-200"}`}
        />
        <div className="flex flex-col items-center gap-1.5">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold border-2 ${
              hasEnabled
                ? "bg-emerald-600 border-emerald-600 text-white"
                : "border-stone-300 text-stone-400 bg-white"
            }`}
          >
            2
          </div>
          <span className="text-xs text-stone-500 font-medium">Select & Save</span>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-stone-500">Google Account:</span>
          <span className="font-medium text-stone-800">
            {conn?.googleEmail ?? "Not connected"}
          </span>
          {conn?.status && (
            <Badge
              variant={isReauth ? "destructive" : "secondary"}
              className={!isReauth ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : ""}
            >
              {conn.status}
            </Badge>
          )}
        </div>

        {isReauth && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
            <AlertTriangle className="size-4 mt-0.5 shrink-0 text-red-600" />
            <p>
              Your Google connection needs to be refreshed. Please sign out and sign back
              in to re-authorize access to your business locations.
            </p>
          </div>
        )}
      </div>

      <LocationSelectorClient locations={locations} />
    </div>
  )
}
