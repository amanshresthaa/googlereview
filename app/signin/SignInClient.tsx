"use client"

import { signIn } from "next-auth/react"

export function SignInClient({ callbackUrl }: { callbackUrl: string }) {
  return (
    <button
      type="button"
      aria-label="Sign in with Google"
      onClick={() => signIn("google", { callbackUrl })}
      className="flex items-center gap-3 bg-white border border-stone-200 px-8 py-3 rounded-xl font-medium text-stone-700 shadow-sm hover:bg-emerald-50 hover:border-emerald-200 transition-all"
    >
      <img
        src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png"
        className="w-5 h-5"
        alt="Google"
      />
      Continue with Google
    </button>
  )
}
