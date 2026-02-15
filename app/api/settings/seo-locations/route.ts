import { z } from "zod"
import { revalidateTag } from "next/cache"
import { prisma } from "@/lib/db"
import { Prisma } from "@prisma/client"
import { handleAuthedPost } from "@/lib/api/handler"
import { ApiError } from "@/lib/api/errors"
import { zodFields } from "@/lib/api/validation"
import { requireRole } from "@/lib/api/authz"
import { SEO_PROFILE_LIMITS } from "@/lib/policy"
import { normalizeSeoProfile } from "@/lib/seo/keywords"
import { sidebarCacheTag } from "@/lib/sidebar-data"
import { dspyConfigSchema, normalizeDspyConfigInput } from "@/lib/ai/dspy-config"

export const runtime = "nodejs"

const keywordArraySchema = z.array(z.string().min(1).max(SEO_PROFILE_LIMITS.KEYWORD_MAX_LENGTH))

const bodySchema = z.object({
  locations: z
    .array(
      z.object({
        locationId: z.string().min(1),
        primaryKeywords: keywordArraySchema.max(SEO_PROFILE_LIMITS.PRIMARY_MAX * 2),
        secondaryKeywords: keywordArraySchema.max(SEO_PROFILE_LIMITS.SECONDARY_MAX * 2),
        geoTerms: keywordArraySchema.max(SEO_PROFILE_LIMITS.GEO_MAX * 2),
        dspyConfig: dspyConfigSchema.nullable().optional(),
      }),
    )
    .max(200),
})

function toNullableJsonValue(value: unknown | null | undefined) {
  if (value === undefined) return undefined
  if (value === null) return Prisma.DbNull
  return value as Prisma.InputJsonValue
}

export async function POST(req: Request) {
  return handleAuthedPost(req, { rateLimitScope: "SETTINGS_UPDATE", idempotency: { required: true } }, async ({ session, body }) => {
    requireRole(session, ["OWNER"], "Only OWNER can update SEO keyword profiles.")

    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      const { details, fields } = zodFields(parsed.error)
      throw new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid request body.", details, fields })
    }

    const updates = parsed.data.locations
    const dedup = new Set<string>()
    for (const update of updates) {
      if (dedup.has(update.locationId)) {
        throw new ApiError({
          status: 400,
          code: "BAD_REQUEST",
          message: "Duplicate locationId in request.",
          fields: { locations: ["Each locationId can appear only once."] },
        })
      }
      dedup.add(update.locationId)
    }

    const existing = await prisma.location.findMany({
      where: { orgId: session.orgId, id: { in: updates.map((u) => u.locationId) } },
      select: { id: true },
    })
    if (existing.length !== updates.length) {
      throw new ApiError({ status: 404, code: "NOT_FOUND", message: "One or more locations not found." })
    }

    await prisma.$transaction(async (tx) => {
      for (const update of updates) {
        const normalized = normalizeSeoProfile({
          primaryKeywords: update.primaryKeywords,
          secondaryKeywords: update.secondaryKeywords,
          geoTerms: update.geoTerms,
        })
        const dspyConfig =
          update.dspyConfig === undefined ? undefined : normalizeDspyConfigInput(update.dspyConfig)

        await tx.location.update({
          where: { id: update.locationId },
          data: {
            seoPrimaryKeywords: normalized.primaryKeywords,
            seoSecondaryKeywords: normalized.secondaryKeywords,
            seoGeoTerms: normalized.geoTerms,
            dspyConfigJson: toNullableJsonValue(dspyConfig),
          },
        })
      }

      await tx.auditLog.create({
        data: {
          orgId: session.orgId,
          actorUserId: session.user.id,
          action: "LOCATION_SEO_PROFILE_UPDATED",
          entityType: "Location",
          entityId: "bulk",
          metadataJson: {
            locationIds: updates.map((u) => u.locationId),
            dspyConfigUpdatedCount: updates.filter((u) => u.dspyConfig !== undefined).length,
          } as never,
        },
      })
    })

    revalidateTag(sidebarCacheTag(session.orgId), "max")

    return { body: {} }
  })
}
