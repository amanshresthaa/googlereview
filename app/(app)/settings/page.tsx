import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/db"
import { SettingsClient } from "@/app/(app)/settings/settings-client"
import { DEFAULT_AUTODRAFT_RATINGS, DEFAULT_MENTION_KEYWORDS } from "@/lib/policy"

export default async function SettingsPage() {
  const session = await getSession()
  if (!session?.user?.id || !session.orgId) redirect("/signin")

  const [org, settings, google] = await Promise.all([
    prisma.organization.findUnique({ where: { id: session.orgId }, select: { name: true } }),
    prisma.orgSettings.findUnique({ where: { orgId: session.orgId } }),
    prisma.googleConnection.findUnique({
      where: { orgId: session.orgId },
      select: { status: true, googleEmail: true, scopes: true },
    }),
  ])

  return (
    <SettingsClient
      orgName={org?.name ?? "Organization"}
      googleConnection={google}
      settings={{
        tonePreset: settings?.tonePreset ?? "friendly",
        toneCustomInstructions: settings?.toneCustomInstructions ?? null,
        autoDraftEnabled: settings?.autoDraftEnabled ?? true,
        autoDraftForRatings: settings?.autoDraftForRatings ?? [...DEFAULT_AUTODRAFT_RATINGS],
        bulkApproveEnabledForFiveStar: settings?.bulkApproveEnabledForFiveStar ?? true,
        aiProvider: settings?.aiProvider ?? "OPENAI",
        mentionKeywords: settings?.mentionKeywords ?? [...DEFAULT_MENTION_KEYWORDS],
      }}
    />
  )
}

