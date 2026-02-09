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
    <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-lg items-center p-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Connect Google</CardTitle>
          <CardDescription>
            Sign in with Google to sync reviews and publish replies to Google Business Profile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignInClient callbackUrl={callbackUrl} />
          <p className="text-muted-foreground mt-3 text-xs">
            We request access to manage your Google Business Profile locations and reviews.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
