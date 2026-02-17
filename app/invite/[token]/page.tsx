import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  return (
    <div className="bg-invite-gradient grid min-h-[100dvh] place-items-center p-4 md:p-6">
      <Card className="app-surface-shell w-full max-w-md rounded-[28px] border-shell-foreground/10 shadow-floating">
        <CardHeader className="pb-2">
          <p className="app-kicker">Invite</p>
          <CardTitle className="text-xl font-black tracking-tight">Invite Link</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground leading-relaxed font-medium">
          Invites are currently disabled for this deployment. If you expected to be invited,
          contact your administrator.
        </p>
        <div className="app-pane-card rounded-xl bg-muted/35 p-4">
          <p className="text-xs text-muted-foreground font-mono break-all">
            Token: {token}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
          <Link href="/signin">
            <Button type="button" className="app-action-primary w-full sm:w-auto rounded-xl shadow-elevated">Go to sign in</Button>
          </Link>
        </div>
        </CardContent>
      </Card>
    </div>
  )
}
