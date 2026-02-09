"use client"

import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"

export function SignInClient(props: { callbackUrl: string }) {
  return (
    <Button
      onClick={() => signIn("google", { callbackUrl: props.callbackUrl })}
      className="w-full"
    >
      Continue with Google
    </Button>
  )
}
