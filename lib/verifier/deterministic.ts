import { ACTION_CLAIM_BLOCKLIST, MAX_GOOGLE_REPLY_CHARS } from "@/lib/policy"

export type DeterministicViolation = {
  code: string
  message: string
  match?: string
}

export function runDeterministicVerifier(input: {
  evidenceText: string
  draftText: string
}) {
  const violations: DeterministicViolation[] = []
  const evidence = input.evidenceText.toLowerCase()
  const draft = input.draftText.trim()

  if (!draft.length) {
    violations.push({ code: "EMPTY_DRAFT", message: "Draft reply is empty." })
    return { pass: false, violations }
  }

  if (draft.length > MAX_GOOGLE_REPLY_CHARS) {
    violations.push({
      code: "TOO_LONG",
      message: `Reply exceeds Google limit (${MAX_GOOGLE_REPLY_CHARS} characters).`,
    })
  }

  for (const re of ACTION_CLAIM_BLOCKLIST) {
    const m = draft.match(re)
    if (m) {
      const matchText = m[0].toLowerCase()
      if (matchText && evidence.includes(matchText)) continue
      // Deterministic rule: never claim actions were taken unless the review explicitly says so.
      // We don't attempt to prove it here; the LLM verifier can allow exceptions when evidence contains it.
      violations.push({
        code: "ACTION_CLAIM",
        message: "Draft appears to claim actions were taken. Remove or rewrite conservatively.",
        match: m[0],
      })
    }
  }

  const pass = violations.length === 0
  return { pass, violations }
}
