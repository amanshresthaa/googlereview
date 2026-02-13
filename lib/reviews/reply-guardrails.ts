import type { VerifierViolation } from "@/lib/ai/draft"
import { ACTION_CLAIM_BLOCKLIST, MAX_GOOGLE_REPLY_CHARS } from "@/lib/policy"

const PHONE_CANDIDATE_RE = /(?:\+?\d[\d\s().-]{6,}\d)/g

export function buildLocalReplyPolicyViolations(input: {
  text: string
}): VerifierViolation[] {
  const text = input.text.trim()
  const violations: VerifierViolation[] = []

  if (text.length > MAX_GOOGLE_REPLY_CHARS) {
    violations.push({
      code: "REPLY_TOO_LONG",
      message: `Reply exceeds Google limit (${MAX_GOOGLE_REPLY_CHARS} characters).`,
    })
  }

  const phoneSnippet = findPhoneNumberSnippet(text)
  if (phoneSnippet) {
    violations.push({
      code: "PHONE_NUMBER_IN_BODY",
      message: "Remove phone numbers from reply text. Use GBP call or website buttons instead.",
      snippet: phoneSnippet,
    })
  }

  const actionClaimSnippet = findActionClaimSnippet(text)
  if (actionClaimSnippet) {
    violations.push({
      code: "ACTION_CLAIM",
      message: "Remove unverifiable action claims (refund, retraining, investigation, or outreach claims).",
      snippet: actionClaimSnippet,
    })
  }

  return mergeVerifierViolations(violations)
}

export function mergeVerifierViolations(
  ...sources: Array<Array<VerifierViolation> | null | undefined>
): VerifierViolation[] {
  const merged: VerifierViolation[] = []
  const seen = new Set<string>()

  for (const source of sources) {
    if (!source) continue

    for (const violation of source) {
      const normalized = normalizeViolation(violation)
      if (!normalized) continue

      const key = `${normalized.code.toLowerCase()}|${normalized.message.toLowerCase()}|${(normalized.snippet ?? "").toLowerCase()}`
      if (seen.has(key)) continue

      seen.add(key)
      merged.push(normalized)
    }
  }

  return merged
}

function normalizeViolation(violation: VerifierViolation): VerifierViolation | null {
  const code = violation.code.trim()
  const message = violation.message.trim()
  const snippet = violation.snippet?.trim()

  if (!code || !message) return null
  return {
    code,
    message,
    ...(snippet ? { snippet } : {}),
  }
}

function findPhoneNumberSnippet(text: string): string | null {
  const candidates = text.match(PHONE_CANDIDATE_RE) ?? []
  for (const candidate of candidates) {
    const digitCount = (candidate.match(/\d/g) ?? []).length
    if (digitCount >= 7) return candidate.trim()
  }
  return null
}

function findActionClaimSnippet(text: string): string | null {
  for (const pattern of ACTION_CLAIM_BLOCKLIST) {
    const match = text.match(pattern)
    if (match?.[0]) {
      return match[0]
    }
  }
  return null
}
