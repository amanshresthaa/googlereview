import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { sha256Hex } from "@/lib/crypto"
import { getSession } from "@/lib/session"
import { SignInClient } from "@/app/signin/SignInClient"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function InvitePage(ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const tokenHash = sha256Hex(token)

  const invite = await prisma.invite.findUnique({
    where: { tokenHash },
  })

  if (!invite) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-lg items-center p-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Invite not found</CardTitle>
            <CardDescription>The invite link is invalid or has been revoked.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const now = new Date()
  if (invite.usedAt) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-lg items-center p-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Invite already used</CardTitle>
            <CardDescription>This invite link has already been used.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (invite.expiresAt <= now) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-lg items-center p-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Invite expired</CardTitle>
            <CardDescription>Ask your team owner to generate a new invite link.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const session = await getSession()
  if (!session?.user?.id) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-lg items-center p-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Join team</CardTitle>
            <CardDescription>
              Sign in as <span className="font-medium">{invite.email}</span> to accept the invite.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignInClient callbackUrl={`/invite/${token}`} />
          </CardContent>
        </Card>
      </div>
    )
  }

  const sessionEmail = session.user.email?.toLowerCase() ?? ""
  if (sessionEmail !== invite.email.toLowerCase()) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-lg items-center p-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Email mismatch</CardTitle>
            <CardDescription>
              You are signed in as <span className="font-medium">{sessionEmail || "(unknown)"}</span>, but this
              invite is for <span className="font-medium">{invite.email}</span>. Sign out and sign in with the
              invited email.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
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

