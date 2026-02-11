import { z } from "zod"
import type { Prisma } from "@prisma/client"

export const reviewsFilterSchema = z.enum(["unanswered", "urgent", "five_star", "mentions", "all"])
export type ReviewsFilter = z.infer<typeof reviewsFilterSchema>
export const reviewsStatusSchema = z.enum(["pending", "replied", "all"])
export type ReviewsStatus = z.infer<typeof reviewsStatusSchema>

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
  status?: ReviewsStatus
  locationId?: string
  rating?: number
  search?: string
}): Prisma.ReviewWhereInput {
  const base: Prisma.ReviewWhereInput = {
    orgId: input.orgId,
    location: { enabled: true },
  }
  const and: Prisma.ReviewWhereInput[] = [base]

  if (input.filter === "unanswered") {
    and.push({ googleReplyComment: null })
  }
  if (input.filter === "urgent") {
    and.push({ googleReplyComment: null, starRating: { lte: 2 } })
  }
  if (input.filter === "five_star") {
    and.push({ starRating: 5 })
  }
  if (input.filter === "mentions") {
    const mention = input.mention?.trim().toLowerCase()
    if (!mention) {
      and.push({ id: "__INVALID__" })
    } else {
      and.push({ mentions: { has: mention } })
    }
  }

  if (input.status === "pending") {
    and.push({ googleReplyComment: null })
  } else if (input.status === "replied") {
    and.push({ googleReplyComment: { not: null } })
  }

  if (input.locationId) {
    and.push({ locationId: input.locationId })
  }

  if (typeof input.rating === "number") {
    and.push({ starRating: input.rating })
  }

  const search = input.search?.trim()
  if (search) {
    and.push({
      OR: [
        { reviewerDisplayName: { contains: search, mode: "insensitive" } },
        { comment: { contains: search, mode: "insensitive" } },
        { location: { displayName: { contains: search, mode: "insensitive" } } },
      ],
    })
  }

  return and.length === 1 ? base : { AND: and }
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
