import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { SignInClient } from "@/app/signin/SignInClient"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  const session = await getSession()
  if (session?.user?.id && session.orgId) redirect("/")

  const sp = await searchParams
  const callbackUrl = sp.from?.startsWith("/") ? sp.from : "/"

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-lg font-semibold tracking-tight">LapenInns</h1>
          <p className="text-muted-foreground mt-1 text-sm">Review inbox</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Connect Google</CardTitle>
            <CardDescription>
              Sign in to sync reviews and publish replies.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <SignInClient callbackUrl={callbackUrl} />
            <p className="text-muted-foreground text-xs leading-relaxed">
              We request access to manage your Google Business Profile locations and reviews.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
