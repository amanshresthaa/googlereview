"use client"

import Image from "next/image"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"

export function SignInClient({ callbackUrl }: { callbackUrl: string }) {
  return (
    <Button
      type="button"
      className="w-full justify-center gap-3 rounded-2xl h-14 text-base font-semibold shadow-google-md"
      onClick={() => signIn("google", { callbackUrl })}
    >
      <Image
        src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png"
        alt="Google"
        width={18}
        height={18}
      />
      Continue with Google
    </Button>
  )
}
