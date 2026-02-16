import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  return (
    <div className="grid min-h-[100dvh] place-items-center p-4 md:p-6">
      <Card className="w-full max-w-md rounded-2xl p-5 md:p-8 space-y-5 shadow-floating border-border">
        <h1 className="text-lg md:text-xl font-bold tracking-tight">Invite Link</h1>
        <p className="text-sm text-muted-foreground leading-relaxed font-medium">
          Invites are currently disabled for this deployment. If you expected to be invited,
          contact your administrator.
        </p>
        <div className="rounded-xl bg-muted p-4 border">
          <p className="text-xs text-muted-foreground font-mono break-all">
            Token: {token}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
          <Link href="/signin">
            <Button type="button" className="w-full sm:w-auto rounded-xl shadow-elevated">Go to sign in</Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
