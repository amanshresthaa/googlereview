import { prisma } from "@/lib/db"
import { env } from "@/lib/env"
import { decryptString, encryptString } from "@/lib/crypto"
import { NonRetryableError } from "@/lib/jobs/errors"

type TokenResult = {
  accessToken: string
  expiresAt: Date
}

export async function getAccessTokenForOrg(orgId: string): Promise<TokenResult> {
  const e = env()
  const conn = await prisma.googleConnection.findUnique({ where: { orgId } })
  if (!conn) throw new Error("Google connection not found.")
  if (conn.status !== "ACTIVE") {
    throw new NonRetryableError("FORBIDDEN", "Google connection requires reconnect.")
  }

  const now = Date.now()
  const cachedExp = conn.accessTokenExpiresAt?.getTime() ?? 0
  const cachedOk = conn.accessTokenEnc && cachedExp - now > 2 * 60 * 1000
  if (cachedOk) {
    return {
      accessToken: decryptString(conn.accessTokenEnc!, e.TOKEN_ENCRYPTION_KEY),
      expiresAt: conn.accessTokenExpiresAt!,
    }
  }

  const refreshToken = decryptString(conn.refreshTokenEnc, e.TOKEN_ENCRYPTION_KEY)
  if (!refreshToken || refreshToken === "MISSING") {
    await prisma.googleConnection.update({
      where: { orgId },
      data: { status: "REAUTH_REQUIRED" },
    })
    throw new NonRetryableError("FORBIDDEN", "Missing refresh token. Reconnect Google to enable background sync.")
  }

  const refreshed = await refreshAccessToken(refreshToken)
  await prisma.googleConnection.update({
    where: { orgId },
    data: {
      accessTokenEnc: encryptString(refreshed.accessToken, e.TOKEN_ENCRYPTION_KEY),
      accessTokenExpiresAt: refreshed.expiresAt,
      status: "ACTIVE",
    },
  })

  return refreshed
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResult> {
  const e = env()
  const body = new URLSearchParams({
    client_id: e.GOOGLE_CLIENT_ID,
    client_secret: e.GOOGLE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  })

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to refresh Google access token: ${res.status} ${text}`)
  }

  const json = (await res.json()) as {
    access_token: string
    expires_in: number
    token_type: string
    scope?: string
  }

  const expiresAt = new Date(Date.now() + json.expires_in * 1000)
  return { accessToken: json.access_token, expiresAt }
}
