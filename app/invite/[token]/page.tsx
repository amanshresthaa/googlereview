import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { sha256Hex } from "@/lib/crypto"
import { getSession } from "@/lib/session"
import { SignInClient } from "@/app/signin/SignInClient"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <p className="text-center text-sm font-semibold tracking-tight">LapenInns</p>
        {children}
      </div>
    </div>
  )
}

export default async function InvitePage(ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const tokenHash = sha256Hex(token)

  const invite = await prisma.invite.findUnique({
    where: { tokenHash },
  })

  if (!invite) {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Invite not found</CardTitle>
            <CardDescription>The invite link is invalid or has been revoked.</CardDescription>
          </CardHeader>
        </Card>
      </Shell>
    )
  }

  const now = new Date()
  if (invite.usedAt) {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Invite already used</CardTitle>
            <CardDescription>This invite link has already been used.</CardDescription>
          </CardHeader>
        </Card>
      </Shell>
    )
  }

  if (invite.expiresAt <= now) {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Invite expired</CardTitle>
            <CardDescription>Ask your team owner to generate a new invite link.</CardDescription>
          </CardHeader>
        </Card>
      </Shell>
    )
  }

  const session = await getSession()
  if (!session?.user?.id) {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Join team</CardTitle>
            <CardDescription>
              Sign in as <span className="font-medium">{invite.email}</span> to accept.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignInClient callbackUrl={`/invite/${token}`} />
          </CardContent>
        </Card>
      </Shell>
    )
  }

  const sessionEmail = session.user.email?.toLowerCase() ?? ""
  if (sessionEmail !== invite.email.toLowerCase()) {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Wrong account</CardTitle>
            <CardDescription>
              Signed in as <span className="font-medium">{sessionEmail || "(unknown)"}</span>.
              This invite is for <span className="font-medium">{invite.email}</span>.
              Sign out and try again.
            </CardDescription>
          </CardHeader>
        </Card>
      </Shell>
    )
  }

  await prisma.$transaction(async (tx) => {
    await tx.membership.upsert({
      where: { orgId_userId: { orgId: invite.orgId, userId: session.user.id } },
      update: { role: invite.role },
      create: {
        orgId: invite.orgId,
        userId: session.user.id,
        role: invite.role,
      },
    })
    await tx.invite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    })
  })

  redirect("/")
}
