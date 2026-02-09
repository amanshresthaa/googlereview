import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"

export async function getSession() {
  return getServerSession(authOptions())
}

export async function requireApiSession() {
  const session = await getSession()
  if (!session?.user?.id || !session.orgId) {
    return null
  }
  return session
}
