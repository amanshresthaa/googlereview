import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { SignInClient } from "@/app/signin/SignInClient"
import { Bell } from "lucide-react"

const ERROR_MESSAGES: Record<string, string> = {
  access_denied:
    "Access denied. Your Google account may not be authorized. Contact your admin or check if the app is verified.",
  OAuthCallback: "Authentication failed. Please try again.",
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>
}) {
  const session = await getSession()
  if (session?.user?.id && session.orgId) redirect("/")

  const sp = await searchParams
  const callbackUrl = sp.from?.startsWith("/") ? sp.from : "/"
  const error = sp.error
  const errorMessage = error
    ? ERROR_MESSAGES[error] ?? error
    : null

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-amber-50 p-6">
      <div className="w-full max-w-sm flex flex-col items-center text-center rounded-2xl bg-white/80 backdrop-blur border border-amber-100 shadow-xl shadow-amber-100/40 px-8 py-12">
        <div className="w-14 h-14 bg-emerald-600 rounded-full flex items-center justify-center mb-5 shadow-lg shadow-emerald-200">
          <Bell className="text-white w-7 h-7" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-stone-900">
          LapenInns
        </h1>
        <p className="text-stone-500 text-sm mt-1 mb-8">
          AI-powered review management for hospitality
        </p>

        {errorMessage && (
          <div className="w-full mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <SignInClient callbackUrl={callbackUrl} />

        <p className="mt-6 text-xs text-stone-400">
          Requires{" "}
          <code className="bg-stone-100 px-1 py-0.5 rounded text-stone-600 font-mono text-[11px]">
            business.manage
          </code>{" "}
          permission to sync reviews.
        </p>
      </div>
    </div>
  )
}
