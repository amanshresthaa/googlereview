import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { UsersClient } from "@/app/(app)/users/users-client"
import { getUsersSidebarData } from "@/lib/sidebar-data"

export default async function UsersPage() {
  const session = await getSession()
  if (!session?.user?.id || !session.orgId) redirect("/signin")

  const { memberships, invites } = await getUsersSidebarData(session.orgId)

  return (
    <UsersClient
      members={memberships.map((m) => ({
        userId: m.userId,
        email: m.user.email,
        name: m.user.name,
        role: m.role,
        createdAtIso: m.createdAt.toISOString(),
      }))}
      invites={invites.map((i) => ({
        inviteId: i.id,
        email: i.email,
        role: i.role,
        expiresAtIso: i.expiresAt.toISOString(),
        createdAtIso: i.createdAt.toISOString(),
      }))}
      canManage={session.role === "OWNER"}
    />
  )
}
