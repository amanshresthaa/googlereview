import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { SettingsClient } from "@/app/(app)/settings/settings-client"
import { getSettingsSidebarData } from "@/lib/sidebar-data"
import { DEFAULT_AUTODRAFT_RATINGS, DEFAULT_MENTION_KEYWORDS } from "@/lib/policy"

export default async function SettingsPage() {
  const session = await getSession()
  if (!session?.user?.id || !session.orgId) redirect("/signin")

  const { org, settings, google } = await getSettingsSidebarData(session.orgId)

  return (
    <SettingsClient
      orgName={org?.name ?? "Organization"}
      googleConnection={google}
      showBulkApprove
      settings={{
        tonePreset: settings?.tonePreset ?? "friendly",
        toneCustomInstructions: settings?.toneCustomInstructions ?? null,
        autoDraftEnabled: settings?.autoDraftEnabled ?? true,
        autoDraftForRatings: settings?.autoDraftForRatings ?? [...DEFAULT_AUTODRAFT_RATINGS],
        bulkApproveEnabledForFiveStar: settings?.bulkApproveEnabledForFiveStar ?? true,
        mentionKeywords: settings?.mentionKeywords ?? [...DEFAULT_MENTION_KEYWORDS],
      }}
    />
  )
}
