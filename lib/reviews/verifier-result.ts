import { unwrapVerifierResultPayload } from "@/lib/reviews/verifier-envelope"

type VerifierLikePayload = {
  issues?: unknown
  dspy?: {
    verifier?: {
      violations?: Array<{ message?: unknown }> | unknown
    }
  }
  policy?: {
    localViolations?: Array<{ message?: unknown }> | unknown
  }
}

export function extractVerifierIssueMessages(payload: unknown): string[] {
  const source = unwrapVerifierResultPayload(payload) ?? payload
  const value = source as VerifierLikePayload | null | undefined
  if (!value || typeof value !== "object") return []

  const fromIssues = toStringArray(value.issues)
  const fromDspy = toViolationMessages(value.dspy?.verifier?.violations)
  const fromPolicy = toViolationMessages(value.policy?.localViolations)

  const merged = [...fromIssues, ...fromDspy, ...fromPolicy]
  const seen = new Set<string>()
  const deduped: string[] = []
  for (const message of merged) {
    const normalized = message.trim()
    if (!normalized) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(normalized)
  }

  return deduped
}

export function getFirstVerifierIssueMessage(payload: unknown): string | null {
  return extractVerifierIssueMessages(payload)[0] ?? null
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

function toViolationMessages(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (item && typeof item === "object" ? (item as { message?: unknown }).message : null))
    .filter((message): message is string => typeof message === "string")
}
