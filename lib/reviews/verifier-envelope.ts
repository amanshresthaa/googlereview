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
}

export function buildVerifierResultEnvelope(input: {
  decisionSource: VerifierDecisionSource
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
}
