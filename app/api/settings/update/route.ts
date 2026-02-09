import { NextResponse } from "next/server"
import { z } from "zod"
import { requireApiSession } from "@/lib/session"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

const bodySchema = z
  .object({
    tonePreset: z.string().min(1).max(50).optional(),
    toneCustomInstructions: z.string().max(2000).nullable().optional(),
    autoDraftEnabled: z.boolean().optional(),
    autoDraftForRatings: z.array(z.number().int().min(1).max(5)).max(5).optional(),
    bulkApproveEnabledForFiveStar: z.boolean().optional(),
    aiProvider: z.enum(["OPENAI", "GEMINI"]).optional(),
    mentionKeywords: z.array(z.string().min(1).max(40)).max(50).optional(),
  })
  .strict()

export async function POST(req: Request) {
  const session = await requireApiSession()
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })

  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "BAD_REQUEST", details: parsed.error.flatten() }, { status: 400 })
  }

  const data = parsed.data
  await prisma.orgSettings.upsert({
    where: { orgId: session.orgId },
    update: {
      tonePreset: data.tonePreset ?? undefined,
      toneCustomInstructions:
        data.toneCustomInstructions === undefined ? undefined : data.toneCustomInstructions,
      autoDraftEnabled: data.autoDraftEnabled ?? undefined,
      autoDraftForRatings: data.autoDraftForRatings ?? undefined,
      bulkApproveEnabledForFiveStar: data.bulkApproveEnabledForFiveStar ?? undefined,
      aiProvider: data.aiProvider ?? undefined,
      mentionKeywords: data.mentionKeywords
        ? data.mentionKeywords.map((k) => k.trim().toLowerCase()).filter(Boolean)
        : undefined,
    },
    create: {
      orgId: session.orgId,
      tonePreset: data.tonePreset ?? "friendly",
      toneCustomInstructions: data.toneCustomInstructions ?? null,
      autoDraftEnabled: data.autoDraftEnabled ?? true,
      autoDraftForRatings: data.autoDraftForRatings ?? [1, 2, 3, 4, 5],
      bulkApproveEnabledForFiveStar: data.bulkApproveEnabledForFiveStar ?? true,
      aiProvider: data.aiProvider ?? "OPENAI",
      mentionKeywords: data.mentionKeywords
        ? data.mentionKeywords.map((k) => k.trim().toLowerCase()).filter(Boolean)
        : ["cold", "wait", "rude", "dirty", "booking", "wrong order"],
    },
  })

  return NextResponse.json({ ok: true })
}

