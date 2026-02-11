import { z } from "zod"
import { ApiError } from "@/lib/api/errors"

export async function readJsonBody(req: Request) {
  return req.json().catch(() => null) as Promise<unknown>
}

export function zodFields(error: z.ZodError) {
  const flat = error.flatten()
  const fieldErrors = flat.fieldErrors as Record<string, string[] | undefined>
  const fields: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(fieldErrors)) {
    if (!v || v.length === 0) continue
    fields[k] = v.filter(Boolean) as string[]
  }
  return { details: flat, fields }
}

export function requireUuidV4(input: string | null | undefined, code: "IDEMPOTENCY_KEY_REQUIRED") {
  if (!input) {
    throw new ApiError({ status: 428, code, message: "Idempotency-Key header is required." })
  }
  const parsed = z.string().uuid().safeParse(input)
  if (!parsed.success) {
    throw new ApiError({ status: 428, code, message: "Idempotency-Key must be a UUID." })
  }
  return input
}
