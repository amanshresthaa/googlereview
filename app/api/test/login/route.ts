import { NextResponse } from "next/server"
import crypto from "node:crypto"
import { z } from "zod"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

const E2E_COOKIE_NAME = "__e2e_session"

function requireBearer(req: Request) {
  const expected = process.env.E2E_TEST_SECRET
  if (!expected) return false
  const auth = req.headers.get("authorization") ?? ""
  return auth === `Bearer ${expected}`
}

function allowE2E() {
  // Hard safety: never enable this endpoint in production deployments.
  // In non-prod, require an explicit secret to be present.
  return process.env.NODE_ENV !== "production" && Boolean(process.env.E2E_TEST_SECRET)
}

function signPayloadBase64Url(payloadB64Url: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(payloadB64Url).digest("base64url")
}

const bodySchema = z
  .object({
    email: z.string().email().optional(),
    orgName: z.string().min(1).optional(),
  })
  .optional()

export async function POST(req: Request) {
  if (!allowE2E()) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })
  if (!requireBearer(req)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })

  const parsedBody = bodySchema.safeParse(await req.json().catch(() => undefined))
  if (!parsedBody.success) {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 })
  }

  const email = parsedBody.data?.email ?? "e2e@example.com"
  const orgName = parsedBody.data?.orgName ?? "E2E Org"

  const user = await prisma.user.upsert({
    where: { email },
    update: { name: "E2E User" },
    create: { email, name: "E2E User" },
  })

  // Reuse the oldest org for this user if it exists.
  const existingMembership = await prisma.membership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { orgId: true, role: true },
  })

  const orgId =
    existingMembership?.orgId ??
    (
      await prisma.organization.create({
        data: {
          name: orgName,
          memberships: { create: { userId: user.id, role: "OWNER" } },
          settings: {
            create: {
              autoDraftForRatings: [5],
              mentionKeywords: ["staff", "cleanliness", "service"],
            },
          },
        },
        select: { id: true },
      })
    ).id

  // Ensure at least one enabled location exists for the org.
  const location =
    (await prisma.location.findFirst({
      where: { orgId, enabled: true },
      orderBy: { createdAt: "asc" },
    })) ??
    (await prisma.location.create({
      data: {
        orgId,
        googleAccountId: "e2e-account",
        googleLocationId: `e2e-location-${Date.now()}`,
        displayName: "E2E Location",
        addressSummary: "123 Test St",
        enabled: true,
      },
    }))

  // Seed a minimal set of reviews for the inbox.
  // Keep it idempotent within an org by removing prior E2E seeded reviews (by marker in googleReviewId).
  const seedMarker = "e2e-seed"
  const prior = await prisma.review.findMany({
    where: { orgId, googleReviewId: { contains: seedMarker } },
    select: { id: true },
  })
  if (prior.length > 0) {
    const priorIds = prior.map((r) => r.id)
    await prisma.$transaction(async (tx) => {
      await tx.draftReply.deleteMany({ where: { reviewId: { in: priorIds } } })
      await tx.review.deleteMany({ where: { id: { in: priorIds } } })
    })
  }

  const now = new Date()
  const created = await prisma.review.create({
    data: {
      orgId,
      locationId: location.id,
      googleReviewName: `accounts/e2e/locations/${location.id}/reviews/${seedMarker}-${Date.now()}`,
      googleReviewId: `${seedMarker}-${Date.now()}`,
      starRating: 5,
      comment: "Amazing stay. Friendly staff and spotless room.",
      createTime: now,
      updateTime: now,
      reviewerDisplayName: "E2E Guest",
      reviewerIsAnonymous: false,
      mentions: ["staff", "cleanliness"],
    },
  })

  const draft = await prisma.draftReply.create({
    data: {
      orgId,
      reviewId: created.id,
      version: 1,
      text: "Thank you for the wonderful review. We are glad you enjoyed your stay and our team.",
      origin: "AUTO",
      status: "READY",
      evidenceSnapshotJson: { seed: true },
      verifierResultJson: { ok: true },
    },
  })

  await prisma.review.update({
    where: { id: created.id },
    data: { currentDraftReplyId: draft.id },
  })

  const secret = process.env.E2E_TEST_SECRET
  if (!secret) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })

  const sessionPayloadB64Url = Buffer.from(
    JSON.stringify({
      user: { id: user.id, email: user.email, name: user.name, image: null },
      orgId,
      role: existingMembership?.role ?? "OWNER",
    }),
    "utf8"
  ).toString("base64url")

  const sigB64Url = signPayloadBase64Url(sessionPayloadB64Url, secret)
  const sessionCookieValue = `${sessionPayloadB64Url}.${sigB64Url}`

  const res = NextResponse.json({ ok: true, userId: user.id, orgId })
  res.cookies.set({
    name: E2E_COOKIE_NAME,
    value: sessionCookieValue,
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 8 * 60 * 60,
  })
  return res
}
