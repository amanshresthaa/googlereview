import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

const E2E_COOKIE_NAME = "__e2e_session"

function allowE2E() {
  // Hard safety: never honor this cookie in production deployments.
  // In non-prod, only honor if an explicit secret is configured.
  return process.env.NODE_ENV !== "production" && Boolean(process.env.E2E_TEST_SECRET)
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

function base64UrlEncode(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf)
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  const b64 = btoa(binary)
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

async function signPayloadBase64Url(payloadB64Url: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64Url))
  return base64UrlEncode(sig)
}

async function hasValidE2ECookie(req: NextRequest) {
  if (!allowE2E()) return false

  const secret = process.env.E2E_TEST_SECRET
  if (!secret) return false

  const raw = req.cookies.get(E2E_COOKIE_NAME)?.value
  if (!raw) return false

  const [payloadB64Url, sigB64Url, ...rest] = raw.split(".")
  if (!payloadB64Url || !sigB64Url || rest.length > 0) return false

  const expected = await signPayloadBase64Url(payloadB64Url, secret)
  return timingSafeEqual(sigB64Url, expected)
}

export async function proxy(req: NextRequest) {
  // Playwright E2E uses a signed cookie, not a NextAuth session.
  // If the cookie is present and valid, treat the request as authenticated.
  if (await hasValidE2ECookie(req)) return NextResponse.next()

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    const url = req.nextUrl.clone()
    url.pathname = "/signin"
    url.searchParams.set("from", req.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/performance/:path*",
    "/inbox/:path*",
    "/reviews/:path*",
    "/locations/:path*",
    "/users/:path*",
    "/settings/:path*",
    "/onboarding/:path*",
  ],
}
