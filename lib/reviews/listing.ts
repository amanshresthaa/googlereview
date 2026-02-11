import { z } from "zod"
import type { Prisma } from "@prisma/client"

export const reviewsFilterSchema = z.enum(["unanswered", "urgent", "five_star", "mentions", "all"])
export type ReviewsFilter = z.infer<typeof reviewsFilterSchema>

const cursorPayloadSchema = z.object({
  t: z.string().datetime(),
  id: z.string().min(1),
})

export type ReviewsCursor = z.infer<typeof cursorPayloadSchema>

export function encodeReviewsCursor(input: ReviewsCursor) {
  const json = JSON.stringify(input)
  return Buffer.from(json, "utf8").toString("base64url")
}

export function decodeReviewsCursor(cursor: string): ReviewsCursor {
  let raw = ""
  try {
    raw = Buffer.from(cursor, "base64url").toString("utf8")
  } catch {
    throw new Error("BAD_CURSOR")
  }
  let json: unknown
  try {
    json = JSON.parse(raw) as unknown
  } catch {
    throw new Error("BAD_CURSOR")
  }
  const parsed = cursorPayloadSchema.safeParse(json)
  if (!parsed.success) throw new Error("BAD_CURSOR")
  return parsed.data
}

export function buildReviewWhere(input: {
  orgId: string
  filter: ReviewsFilter
  mention?: string
}): Prisma.ReviewWhereInput {
  const base: Prisma.ReviewWhereInput = {
    orgId: input.orgId,
    location: { enabled: true },
  }

  if (input.filter === "unanswered") {
    return { ...base, googleReplyComment: null }
  }
  if (input.filter === "urgent") {
    return { ...base, googleReplyComment: null, starRating: { lte: 2 } }
  }
  if (input.filter === "five_star") {
    return { ...base, starRating: 5 }
  }
  if (input.filter === "mentions") {
    const mention = input.mention?.trim().toLowerCase()
    if (!mention) {
      // Caller should validate; keep function total and deterministic.
      return { ...base, id: "__INVALID__" }
    }
    return { ...base, mentions: { has: mention } }
  }
  return base
}

export function buildReviewCountsWhere(input: { orgId: string; key: "unanswered" | "urgent" | "five_star" | "mentions_total" }) {
  const base: Prisma.ReviewWhereInput = {
    orgId: input.orgId,
    location: { enabled: true },
  }

  if (input.key === "unanswered") return { ...base, googleReplyComment: null }
  if (input.key === "urgent") return { ...base, googleReplyComment: null, starRating: { lte: 2 } }
  if (input.key === "five_star") return { ...base, starRating: 5 }
  return { ...base, mentions: { isEmpty: false } }
}

