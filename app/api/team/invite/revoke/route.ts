import { z } from "zod"
import { revalidateTag } from "next/cache"
import { prisma } from "@/lib/db"
import { handleAuthedPost } from "@/lib/api/handler"
import { ApiError } from "@/lib/api/errors"
import { zodFields } from "@/lib/api/validation"
import { requireRole } from "@/lib/api/authz"
import { sidebarCacheTag } from "@/lib/sidebar-data"

export const runtime = "nodejs"

const bodySchema = z.object({
  inviteId: z.string().min(1),
})

export async function POST(req: Request) {
  return handleAuthedPost(
    req,
    { rateLimitScope: "TEAM_INVITE_REVOKE", idempotency: { required: true } },
    async ({ session, body }) => {
      requireRole(session, ["OWNER"], "Only OWNER can revoke invites.")

      const parsed = bodySchema.safeParse(body)
      if (!parsed.success) {
        const { details, fields } = zodFields(parsed.error)
        throw new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid request body.", details, fields })
      }

      await prisma.$transaction(async (tx) => {
        await tx.invite.updateMany({
          where: { id: parsed.data.inviteId, orgId: session.orgId, usedAt: null },
          data: { expiresAt: new Date(0) },
        })
        await tx.auditLog.create({
          data: {
            orgId: session.orgId,
            actorUserId: session.user.id,
            action: "TEAM_INVITE_REVOKED",
            entityType: "Invite",
            entityId: parsed.data.inviteId,
          },
        })
      })

      revalidateTag(sidebarCacheTag(session.orgId), "max")

      return { body: {} }
    }
  )
}
