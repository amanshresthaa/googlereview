import { redirect } from "next/navigation"
import type { ComponentProps } from "react"
import { getSession } from "@/lib/session"
import { SettingsClient } from "@/app/(app)/settings/settings-client"
import { getSettingsSidebarData } from "@/lib/sidebar-data"
import { parseStoredDspyConfig } from "@/lib/ai/dspy-config"
import { DEFAULT_AUTODRAFT_RATINGS, DEFAULT_MENTION_KEYWORDS } from "@/lib/policy"

type SettingsClientSettingsWithDspyConfig = ComponentProps<typeof SettingsClient>["settings"] & {
  dspyConfig: ReturnType<typeof parseStoredDspyConfig>
}

export default async function SettingsPage() {
  const session = await getSession()
  if (!session?.user?.id || !session.orgId) redirect("/signin")

  const { org, settings, google, locations } = await getSettingsSidebarData(session.orgId)
  const dspyConfig = parseStoredDspyConfig(settings?.dspyConfigJson ?? null)
  const locationPayload = locations.map((location) => ({
    id: location.id,
    displayName: location.displayName,
    seoPrimaryKeywords: location.seoPrimaryKeywords,
    seoSecondaryKeywords: location.seoSecondaryKeywords,
    seoGeoTerms: location.seoGeoTerms,
    dspyConfig: parseStoredDspyConfig(location.dspyConfigJson ?? null),
  }))
  const settingsPayload: SettingsClientSettingsWithDspyConfig = {
    tonePreset: settings?.tonePreset ?? "friendly",
    toneCustomInstructions: settings?.toneCustomInstructions ?? null,
    autoDraftEnabled: settings?.autoDraftEnabled ?? true,
    autoDraftForRatings: settings?.autoDraftForRatings ?? [...DEFAULT_AUTODRAFT_RATINGS],
    bulkApproveEnabledForFiveStar: settings?.bulkApproveEnabledForFiveStar ?? true,
    mentionKeywords: settings?.mentionKeywords ?? [...DEFAULT_MENTION_KEYWORDS],
    dspyConfig,
  }

  return (
    <SettingsClient
      orgName={org?.name ?? "Organization"}
      googleConnection={google}
      locations={locationPayload}
      showBulkApprove
      settings={settingsPayload}
    />
  )
}
