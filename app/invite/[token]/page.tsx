import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10">
      <Card className="w-full max-w-md rounded-3xl p-8 space-y-5 shadow-xl border">
        <h1 className="text-xl font-bold tracking-tight">Invite Link</h1>
        <p className="text-sm text-muted-foreground leading-relaxed font-medium">
          Invites are currently disabled for this deployment. If you expected to be invited,
          contact your administrator.
        </p>
        <div className="rounded-xl bg-muted p-4 border">
          <p className="text-xs text-muted-foreground font-mono break-all">
            Token: {token}
          </p>
        </div>
        <div className="flex justify-end">
          <Link href="/signin">
            <Button type="button" className="rounded-xl shadow-google-sm">Go to sign in</Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
