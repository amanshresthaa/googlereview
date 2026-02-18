import Link from "next/link"

export default function SignInPage() {
  return (
    <main className="app-container py-16">
      <div className="app-surface-shell mx-auto max-w-md rounded-3xl p-8 text-center">
        <h1 className="text-2xl font-black tracking-tight">Sign in required</h1>
        <p className="mt-2 text-sm text-shell-foreground/60">Authenticate to access the operational inbox.</p>
        <Link
          href="/inbox"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-xl border border-brand/35 bg-brand px-5 text-sm font-bold text-brand-foreground shadow-glow-primary"
        >
          Open Inbox
        </Link>
      </div>
    </main>
  )
}
