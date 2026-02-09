import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import { SettingsClient } from "@/app/(app)/settings/SettingsClient"
import { DEFAULT_AUTODRAFT_RATINGS, DEFAULT_MENTION_KEYWORDS } from "@/lib/policy"

export default async function SettingsPage() {
  const session = await getSession()
  if (!session?.user?.id || !session.orgId) redirect("/signin")

  const membership = await prisma.membership.findUnique({
    where: { orgId_userId: { orgId: session.orgId, userId: session.user.id } },
  })
  if (!membership) redirect("/signin")

  const settings = await prisma.orgSettings.findUnique({ where: { orgId: session.orgId } })
  const members = await prisma.membership.findMany({
    where: { orgId: session.orgId },
    include: { user: true },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  })
  const invites = await prisma.invite.findMany({
    where: { orgId: session.orgId, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    take: 20,
  })

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6 animate-fade-in overflow-y-auto h-full">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">Configure AI behavior and manage your team.</p>
      </div>

      <SettingsClient
        isOwner={membership.role === "OWNER"}
        settings={{
          tonePreset: settings?.tonePreset ?? "friendly",
          toneCustomInstructions: settings?.toneCustomInstructions ?? null,
          autoDraftEnabled: settings?.autoDraftEnabled ?? true,
          autoDraftForRatings: settings?.autoDraftForRatings ?? [...DEFAULT_AUTODRAFT_RATINGS],
          bulkApproveEnabledForFiveStar: settings?.bulkApproveEnabledForFiveStar ?? true,
          aiProvider: (settings?.aiProvider ?? "OPENAI") as "OPENAI" | "GEMINI",
          mentionKeywords: settings?.mentionKeywords ?? [...DEFAULT_MENTION_KEYWORDS],
        }}
        members={members.map((m) => ({
          userId: m.userId,
          email: m.user.email,
          name: m.user.name ?? null,
          role: m.role,
        }))}
        invites={invites.map((i) => ({
          id: i.id,
          email: i.email,
          role: i.role,
          expiresAtIso: i.expiresAt.toISOString(),
        }))}
      />
    </div>
  )
}
