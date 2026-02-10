"use client"

import * as React from "react"
import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { LogOut } from "@/components/icons"

export function SignOutButton({ className }: { className?: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={className}
      onClick={() => signOut({ callbackUrl: "/signin" })}
    >
      <LogOut className="size-4" />
      Sign out
    </Button>
  )
}

