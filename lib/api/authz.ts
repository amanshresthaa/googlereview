import type { Session } from "next-auth"
import { ApiError } from "@/lib/api/errors"

export type AppRole = "OWNER" | "MANAGER" | "STAFF"

function roleOf(session: Session): AppRole {
  // Session.role is module-augmented in types/next-auth.d.ts
  return (session as unknown as { role?: AppRole }).role ?? "STAFF"
}

export function requireRole(session: Session, allowed: AppRole[], message?: string) {
  const role = roleOf(session)
  if (!allowed.includes(role)) {
    throw new ApiError({
      status: 403,
      code: "FORBIDDEN",
      message: message ?? "Forbidden.",
    })
  }
  return role
}

