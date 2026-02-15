<<<<<<< ours
<<<<<<< ours
import type { VerifierViolation } from "@/lib/ai/draft"

export const VERIFIER_RESULT_SCHEMA_VERSION = 1 as const

export type VerifierDecisionSource = "DSPY_VERIFIER" | "LOCAL_DETERMINISTIC_POLICY"

export type VerifierPayloadBody = {
  issues?: string[]
  dspy?: {
    decision?: "READY" | "BLOCKED_BY_VERIFIER"
    verifier?: {
      pass?: boolean
      violations?: VerifierViolation[]
      suggestedRewrite?: string | null
    }
    seoQuality?: unknown
    generation?: unknown
    models?: unknown
    trace?: unknown
    latencyMs?: number
  }
  policy?: {
    localViolations?: VerifierViolation[]
  }
}

export type VerifierResultEnvelope = {
  schemaVersion: typeof VERIFIER_RESULT_SCHEMA_VERSION
  decisionSource: VerifierDecisionSource
  payload: VerifierPayloadBody
=======
=======
>>>>>>> theirs
import { verifierViolationSchema } from "@/lib/ai/draft"
import { z } from "zod"

export const VERIFIER_RESULT_SCHEMA_VERSION = 1 as const

const verifierDecisionSourceSchema = z.enum(["DSPY_VERIFIER", "LOCAL_DETERMINISTIC_POLICY"])
const freshnessHashSchema = z.string().regex(/^[a-f0-9]{64}$/)
const verifierPayloadBodySchema = z
  .object({
    issues: z.array(z.string()).optional(),
    dspy: z
      .object({
        decision: z.enum(["READY", "BLOCKED_BY_VERIFIER"]).optional(),
        verifier: z
          .object({
            pass: z.boolean().optional(),
            violations: z.array(verifierViolationSchema).optional(),
            suggestedRewrite: z.string().nullable().optional(),
          })
          .strict()
          .optional(),
        seoQuality: z.unknown().optional(),
        generation: z.unknown().optional(),
        models: z.unknown().optional(),
        trace: z.unknown().optional(),
        latencyMs: z.number().int().nonnegative().optional(),
      })
      .strict()
      .optional(),
    policy: z
      .object({
        localViolations: z.array(verifierViolationSchema).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
const verifierResultEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(VERIFIER_RESULT_SCHEMA_VERSION),
    decisionSource: verifierDecisionSourceSchema,
    freshnessHash: freshnessHashSchema.optional(),
    payload: verifierPayloadBodySchema,
  })
  .strict()

export type VerifierDecisionSource = z.infer<typeof verifierDecisionSourceSchema>
export type VerifierPayloadBody = z.infer<typeof verifierPayloadBodySchema>
export type VerifierResultEnvelope = z.infer<typeof verifierResultEnvelopeSchema>

export function parseVerifierResultEnvelope(value: unknown): VerifierResultEnvelope | null {
  const parsed = verifierResultEnvelopeSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function parseVerifierPayloadBody(value: unknown): VerifierPayloadBody | null {
  const parsed = verifierPayloadBodySchema.safeParse(value)
  return parsed.success ? parsed.data : null
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
}

export function buildVerifierResultEnvelope(input: {
  decisionSource: VerifierDecisionSource
<<<<<<< ours
<<<<<<< ours
  payload: VerifierPayloadBody
}): VerifierResultEnvelope {
  return {
    schemaVersion: VERIFIER_RESULT_SCHEMA_VERSION,
    decisionSource: input.decisionSource,
    payload: input.payload,
  }
}

export function unwrapVerifierResultPayload(payload: unknown): VerifierPayloadBody | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null
  const candidate = payload as {
    schemaVersion?: unknown
    decisionSource?: unknown
    payload?: unknown
  }

  if (candidate.schemaVersion !== VERIFIER_RESULT_SCHEMA_VERSION) return null
  if (typeof candidate.decisionSource !== "string") return null
  if (!candidate.payload || typeof candidate.payload !== "object" || Array.isArray(candidate.payload)) {
    return null
  }

  return candidate.payload as VerifierPayloadBody
=======
=======
>>>>>>> theirs
  freshnessHash?: string
  payload: VerifierPayloadBody
}): VerifierResultEnvelope {
  return verifierResultEnvelopeSchema.parse({
    schemaVersion: VERIFIER_RESULT_SCHEMA_VERSION,
    decisionSource: input.decisionSource,
    freshnessHash: input.freshnessHash,
    payload: input.payload,
  })
}

export function unwrapVerifierResultPayload(payload: unknown): VerifierPayloadBody | null {
  return parseVerifierResultEnvelope(payload)?.payload ?? null
}

export function readVerifierFreshnessHash(payload: unknown): string | null {
  return parseVerifierResultEnvelope(payload)?.freshnessHash ?? null
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
}
