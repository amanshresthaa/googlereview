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
}

export function buildVerifierResultEnvelope(input: {
  decisionSource: VerifierDecisionSource
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
}
