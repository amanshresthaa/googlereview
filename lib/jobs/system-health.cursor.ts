import { z } from "zod"
import { ApiError } from "@/lib/api/errors"

export type JobCursor =
  | { v: 1; order: "RUN_AT_ASC"; runAtIso: string; id: string }
  | { v: 1; order: "COMPLETED_AT_DESC"; completedAtIso: string; id: string }
  | { v: 1; order: "CREATED_AT_DESC"; createdAtIso: string; id: string }

const cursorSchema = z.discriminatedUnion("order", [
  z.object({ v: z.literal(1), order: z.literal("RUN_AT_ASC"), runAtIso: z.string().datetime(), id: z.string().min(1) }),
  z.object({
    v: z.literal(1),
    order: z.literal("COMPLETED_AT_DESC"),
    completedAtIso: z.string().datetime(),
    id: z.string().min(1),
  }),
  z.object({
    v: z.literal(1),
    order: z.literal("CREATED_AT_DESC"),
    createdAtIso: z.string().datetime(),
    id: z.string().min(1),
  }),
])

export function encodeCursor(cursor: JobCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url")
}

export function decodeCursor(raw: string): JobCursor {
  let json: unknown
  try {
    const text = Buffer.from(raw, "base64url").toString("utf8")
    json = JSON.parse(text)
  } catch {
    throw new ApiError({ status: 400, code: "BAD_CURSOR", message: "Invalid cursor." })
  }
  const parsed = cursorSchema.safeParse(json)
  if (!parsed.success) {
    throw new ApiError({ status: 400, code: "BAD_CURSOR", message: "Invalid cursor." })
  }
  return parsed.data
}

export function parseDateOrThrow(iso: string, field: string): Date {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) {
    throw new ApiError({
      status: 400,
      code: "BAD_REQUEST",
      message: "Invalid date.",
      fields: { [field]: ["Invalid ISO date"] },
    })
  }
  return d
}

export function iso(d: Date | null | undefined) {
  return d ? d.toISOString() : null
}

