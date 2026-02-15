import { z } from "zod"
import { revalidateTag } from "next/cache"
import { prisma } from "@/lib/db"
import { Prisma } from "@prisma/client"
import { handleAuthedPost } from "@/lib/api/handler"
import { ApiError } from "@/lib/api/errors"
import { zodFields } from "@/lib/api/validation"
import { requireRole } from "@/lib/api/authz"
import { sidebarCacheTag } from "@/lib/sidebar-data"
import { dspyConfigSchema, normalizeDspyConfigInput } from "@/lib/ai/dspy-config"

export const runtime = "nodejs"

const bodySchema = z
  .object({
    tonePreset: z.string().min(1).max(50).optional(),
    toneCustomInstructions: z.string().max(2000).nullable().optional(),
    autoDraftEnabled: z.boolean().optional(),
    autoDraftForRatings: z.array(z.number().int().min(1).max(5)).max(5).optional(),
    bulkApproveEnabledForFiveStar: z.boolean().optional(),
    mentionKeywords: z.array(z.string().min(1).max(40)).max(50).optional(),
    dspyConfig: dspyConfigSchema.nullable().optional(),
  })
  .strict()

function toNullableJsonValue(value: unknown | null | undefined) {
  if (value === undefined) return undefined
  if (value === null) return Prisma.DbNull
  return value as Prisma.InputJsonValue
}

export async function POST(req: Request) {
  return handleAuthedPost(
    req,
    { rateLimitScope: "SETTINGS_UPDATE", idempotency: { required: true } },
    async ({ session, body }) => {
      requireRole(session, ["OWNER"], "Only OWNER can update settings.")

      const parsed = bodySchema.safeParse(body)
      if (!parsed.success) {
        const { details, fields } = zodFields(parsed.error)
        throw new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid request body.", details, fields })
      }

      const data = parsed.data
      const mentionKeywords =
        data.mentionKeywords?.map((k) => k.trim().toLowerCase()).filter(Boolean) ?? undefined
      const dspyConfig =
        data.dspyConfig === undefined ? undefined : normalizeDspyConfigInput(data.dspyConfig)

      await prisma.$transaction(async (tx) => {
        await tx.orgSettings.upsert({
          where: { orgId: session.orgId },
          update: {
            tonePreset: data.tonePreset ?? undefined,
            toneCustomInstructions:
              data.toneCustomInstructions === undefined ? undefined : data.toneCustomInstructions,
            autoDraftEnabled: data.autoDraftEnabled ?? undefined,
            autoDraftForRatings: data.autoDraftForRatings ?? undefined,
            bulkApproveEnabledForFiveStar: data.bulkApproveEnabledForFiveStar ?? undefined,
            mentionKeywords,
            dspyConfigJson: toNullableJsonValue(dspyConfig),
          },
          create: {
            orgId: session.orgId,
            tonePreset: data.tonePreset ?? "friendly",
            toneCustomInstructions: data.toneCustomInstructions ?? null,
            autoDraftEnabled: data.autoDraftEnabled ?? true,
            autoDraftForRatings: data.autoDraftForRatings ?? [1, 2, 3, 4, 5],
            bulkApproveEnabledForFiveStar: data.bulkApproveEnabledForFiveStar ?? true,
            mentionKeywords: mentionKeywords ?? ["cold", "wait", "rude", "dirty", "booking", "wrong order"],
            dspyConfigJson: toNullableJsonValue(dspyConfig),
          },
        })

        await tx.auditLog.create({
          data: {
            orgId: session.orgId,
            actorUserId: session.user.id,
            action: "SETTINGS_UPDATED",
            entityType: "OrgSettings",
            entityId: session.orgId,
            metadataJson: {
              keys: Object.keys(data).sort(),
            } as never,
          },
        })
      })

      revalidateTag(sidebarCacheTag(session.orgId), "max")

      return { body: {} }
    }
  )
}
