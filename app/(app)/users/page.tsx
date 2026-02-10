import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/db"
import { UsersClient } from "@/app/(app)/users/users-client"

export default async function UsersPage() {
  const session = await getSession()
  if (!session?.user?.id || !session.orgId) redirect("/signin")

  const memberships = await prisma.membership.findMany({
    where: { orgId: session.orgId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  })

  return (
    <UsersClient
      rows={memberships.map((m) => ({
        userId: m.userId,
        email: m.user.email,
        name: m.user.name ?? null,
        role: m.role,
        createdAtIso: m.createdAt.toISOString(),
      }))}
    />
  )
}

