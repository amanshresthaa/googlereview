import { z } from "zod"
import { revalidateTag } from "next/cache"
import { prisma } from "@/lib/db"
import { randomToken, sha256Hex } from "@/lib/crypto"
import { handleAuthedPost } from "@/lib/api/handler"
import { ApiError } from "@/lib/api/errors"
import { zodFields } from "@/lib/api/validation"
import { requireRole } from "@/lib/api/authz"
import { sidebarCacheTag } from "@/lib/sidebar-data"

export const runtime = "nodejs"

const bodySchema = z.object({
  email: z.string().email(),
  role: z.enum(["OWNER", "MANAGER", "STAFF"]).default("STAFF"),
})

export async function POST(req: Request) {
  return handleAuthedPost(
    req,
    { rateLimitScope: "TEAM_INVITE", idempotency: { required: true } },
    async ({ session, body }) => {
      requireRole(session, ["OWNER"], "Only OWNER can invite.")

      const parsed = bodySchema.safeParse(body)
      if (!parsed.success) {
        const { details, fields } = zodFields(parsed.error)
        throw new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid request body.", details, fields })
      }

      const token = randomToken(32)
      const tokenHash = sha256Hex(token)
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      const invite = await prisma.$transaction(async (tx) => {
        const created = await tx.invite.create({
          data: {
            orgId: session.orgId,
            email: parsed.data.email.toLowerCase(),
            role: parsed.data.role,
            tokenHash,
            expiresAt,
            createdByUserId: session.user.id,
          },
        })
        await tx.auditLog.create({
          data: {
            orgId: session.orgId,
            actorUserId: session.user.id,
            action: "TEAM_INVITE_CREATED",
            entityType: "Invite",
            entityId: created.id,
            metadataJson: { role: created.role } as never,
          },
        })
        return created
      })

      revalidateTag(sidebarCacheTag(session.orgId), "max")

      return {
        body: {
          inviteId: invite.id,
          inviteUrl: `/invite/${token}`,
          expiresAt: invite.expiresAt.toISOString(),
        },
      }
    }
  )
}
