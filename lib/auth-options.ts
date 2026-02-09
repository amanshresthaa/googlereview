import type { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { prisma } from "@/lib/db"
import { env } from "@/lib/env"
import { decryptString, encryptString } from "@/lib/crypto"
import { DEFAULT_AUTODRAFT_RATINGS, DEFAULT_MENTION_KEYWORDS, DEFAULT_ORG_NAME } from "@/lib/policy"

export function authOptions(): NextAuthOptions {
  const e = env()
  return {
    secret: e.NEXTAUTH_SECRET,
    session: { strategy: "jwt" },
    providers: [
      GoogleProvider({
        clientId: e.GOOGLE_CLIENT_ID,
        clientSecret: e.GOOGLE_CLIENT_SECRET,
        // Default OAuth HTTP timeout can be too aggressive on some networks.
        // If this times out, NextAuth reports: "outgoing request timed out after 3500ms".
        httpOptions: {
          timeout: 15_000,
        },
        authorization: {
          params: {
            scope: [
              "openid",
              "email",
              "profile",
              "https://www.googleapis.com/auth/business.manage",
            ].join(" "),
            prompt: "consent",
            access_type: "offline",
            response_type: "code",
            include_granted_scopes: "true",
          },
        },
      }),
    ],
    callbacks: {
      async jwt({ token, account, profile }) {
        // On initial sign-in, we get account + profile; use it to bootstrap our app tenant
        // and store/refresh the GBP OAuth tokens for background sync + posting.
        if (account && profile?.email) {
          const email = profile.email
          const name = profile.name ?? null
          const imageUrl = (profile as unknown as { picture?: string }).picture ?? null
          const googleSub = String(profile.sub ?? "")

          const user = await prisma.user.upsert({
            where: { email },
            update: { name: name ?? undefined, imageUrl: imageUrl ?? undefined },
            create: { email, name: name ?? undefined, imageUrl: imageUrl ?? undefined },
          })

          const existingMembership = await prisma.membership.findFirst({
            where: { userId: user.id },
            orderBy: { createdAt: "asc" },
          })

          const orgId =
            existingMembership?.orgId ??
            (await prisma.$transaction(async (tx) => {
              const org = await tx.organization.create({
                data: {
                  name: name ? `${name}'s Org` : DEFAULT_ORG_NAME,
                  memberships: {
                    create: {
                      userId: user.id,
                      role: "OWNER",
                    },
                  },
                  settings: {
                    create: {
                      autoDraftForRatings: [...DEFAULT_AUTODRAFT_RATINGS],
                      mentionKeywords: [...DEFAULT_MENTION_KEYWORDS],
                    },
                  },
                },
              })
              return org.id
            }))

          const membership =
            existingMembership ??
            (await prisma.membership.findUnique({
              where: { orgId_userId: { orgId, userId: user.id } },
            }))

          token.userId = user.id
          token.orgId = orgId
          token.role = membership?.role ?? "OWNER"

          const refreshToken = account.refresh_token ?? null
          const accessToken = account.access_token ?? null
          const expiresAtSec = account.expires_at ?? null
          const scopes = (account.scope ?? "")
            .split(" ")
            .map((s) => s.trim())
            .filter(Boolean)

          const prior = await prisma.googleConnection.findUnique({
            where: { orgId },
            select: { refreshTokenEnc: true },
          })
          const priorHasRefreshToken = (() => {
            if (!prior?.refreshTokenEnc) return false
            try {
              return decryptString(prior.refreshTokenEnc, e.TOKEN_ENCRYPTION_KEY) !== "MISSING"
            } catch {
              return false
            }
          })()

          // If refresh token is missing, do not overwrite an existing refresh token.
          // Google often returns a refresh token only on the first consent.
          if (refreshToken) {
            await prisma.googleConnection.upsert({
              where: { orgId },
              update: {
                status: "ACTIVE",
                googleEmail: email,
                googleSub,
                scopes,
                refreshTokenEnc: encryptString(refreshToken, e.TOKEN_ENCRYPTION_KEY),
                accessTokenEnc: accessToken
                  ? encryptString(accessToken, e.TOKEN_ENCRYPTION_KEY)
                  : undefined,
                accessTokenExpiresAt: expiresAtSec
                  ? new Date(expiresAtSec * 1000)
                  : undefined,
                connectedByUserId: user.id,
              },
              create: {
                orgId,
                status: "ACTIVE",
                googleEmail: email,
                googleSub,
                scopes,
                refreshTokenEnc: encryptString(refreshToken, e.TOKEN_ENCRYPTION_KEY),
                accessTokenEnc: accessToken
                  ? encryptString(accessToken, e.TOKEN_ENCRYPTION_KEY)
                  : undefined,
                accessTokenExpiresAt: expiresAtSec
                  ? new Date(expiresAtSec * 1000)
                  : undefined,
                connectedByUserId: user.id,
              },
            })
          } else if (priorHasRefreshToken) {
            await prisma.googleConnection.update({
              where: { orgId },
              data: {
                status: "ACTIVE",
                googleEmail: email,
                googleSub,
                scopes,
                accessTokenEnc: accessToken
                  ? encryptString(accessToken, e.TOKEN_ENCRYPTION_KEY)
                  : undefined,
                accessTokenExpiresAt: expiresAtSec
                  ? new Date(expiresAtSec * 1000)
                  : undefined,
                connectedByUserId: user.id,
              },
            })
          } else {
            await prisma.googleConnection.upsert({
              where: { orgId },
              update: {
                status: "REAUTH_REQUIRED",
                googleEmail: email,
                googleSub,
                scopes,
                connectedByUserId: user.id,
              },
              create: {
                orgId,
                status: "REAUTH_REQUIRED",
                googleEmail: email,
                googleSub,
                scopes,
                // Keep schema non-null; requires reconnect to populate.
                refreshTokenEnc: encryptString("MISSING", e.TOKEN_ENCRYPTION_KEY),
                connectedByUserId: user.id,
              },
            })
          }
        }

        return token
      },
      async session({ session, token }) {
        if (session.user) {
          session.user.id = (token.userId as string | undefined) ?? ""
        }
        session.orgId = (token.orgId as string | undefined) ?? ""
        session.role = (token.role as string | undefined) ?? ""
        return session
      },
    },
  }
}
