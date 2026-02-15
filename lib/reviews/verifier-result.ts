<<<<<<< ours
<<<<<<< ours
import { unwrapVerifierResultPayload } from "@/lib/reviews/verifier-envelope"
=======
=======
>>>>>>> theirs
import {
  parseVerifierPayloadBody,
  parseVerifierResultEnvelope,
  unwrapVerifierResultPayload,
} from "@/lib/reviews/verifier-envelope"
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs

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
<<<<<<< ours
<<<<<<< ours
  const source = unwrapVerifierResultPayload(payload) ?? payload
  const value = source as VerifierLikePayload | null | undefined
=======
=======
>>>>>>> theirs
  const parsedEnvelope = parseVerifierResultEnvelope(payload)
  if (parsedEnvelope) {
    return dedupeMessages(collectIssueMessages(parsedEnvelope.payload))
  }

  const parsedPayload = parseVerifierPayloadBody(payload)
  if (parsedPayload) {
    return dedupeMessages(collectIssueMessages(parsedPayload))
  }

  const source = unwrapVerifierResultPayload(payload)
  if (source) {
    return dedupeMessages(collectIssueMessages(source))
  }

  const candidates = getLoosePayloadCandidates(payload)
  if (candidates.length === 0) return []
  return dedupeMessages(candidates.flatMap((candidate) => collectIssueMessages(candidate)))
}

export function getFirstVerifierIssueMessage(payload: unknown): string | null {
  return extractVerifierIssueMessages(payload)[0] ?? null
}

function getLoosePayloadCandidates(payload: unknown): VerifierLikePayload[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return []
  const root = payload as Record<string, unknown>
  const nested = root.payload
  const list: VerifierLikePayload[] = [root as VerifierLikePayload]
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    list.push(nested as VerifierLikePayload)
  }
  return list
}

function collectIssueMessages(value: VerifierLikePayload): string[] {
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
  if (!value || typeof value !== "object") return []

  const fromIssues = toStringArray(value.issues)
  const fromDspy = toViolationMessages(value.dspy?.verifier?.violations)
  const fromPolicy = toViolationMessages(value.policy?.localViolations)

<<<<<<< ours
<<<<<<< ours
  const merged = [...fromIssues, ...fromDspy, ...fromPolicy]
  const seen = new Set<string>()
  const deduped: string[] = []
  for (const message of merged) {
=======
=======
>>>>>>> theirs
  return [...fromIssues, ...fromDspy, ...fromPolicy]
}

function dedupeMessages(messages: string[]): string[] {
  const seen = new Set<string>()
  const deduped: string[] = []
  for (const message of messages) {
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
    const normalized = message.trim()
    if (!normalized) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(normalized)
  }

  return deduped
}

<<<<<<< ours
<<<<<<< ours
export function getFirstVerifierIssueMessage(payload: unknown): string | null {
  return extractVerifierIssueMessages(payload)[0] ?? null
}

=======
>>>>>>> theirs
=======
>>>>>>> theirs
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
