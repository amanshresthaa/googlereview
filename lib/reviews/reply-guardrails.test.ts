import { describe, expect, it } from "vitest"

import { MAX_GOOGLE_REPLY_CHARS } from "@/lib/policy"
import { buildLocalReplyPolicyViolations, mergeVerifierViolations } from "@/lib/reviews/reply-guardrails"

describe("buildLocalReplyPolicyViolations", () => {
  it("flags phone numbers and action-claim language", () => {
    const violations = buildLocalReplyPolicyViolations({
      text: "Thanks for your visit. Call us at (555) 321-1234. We have fixed the issue.",
    })

    expect(violations.some((item) => item.code === "PHONE_NUMBER_IN_BODY")).toBe(true)
    expect(violations.some((item) => item.code === "ACTION_CLAIM")).toBe(true)
  })

  it("flags replies that exceed Google character limit", () => {
    const violations = buildLocalReplyPolicyViolations({
      text: "x".repeat(MAX_GOOGLE_REPLY_CHARS + 1),
    })

    expect(violations.some((item) => item.code === "REPLY_TOO_LONG")).toBe(true)
  })

  it("returns no violations for clean deterministic text", () => {
    const violations = buildLocalReplyPolicyViolations({
      text: "Thanks for joining us tonight.",
    })

    expect(violations).toEqual([])
  })
})

describe("mergeVerifierViolations", () => {
  it("dedupes equivalent violations", () => {
    const merged = mergeVerifierViolations(
      [{ code: "A", message: "Alpha" }],
      [{ code: "A", message: "Alpha " }],
      [{ code: "B", message: "Beta" }],
    )

    expect(merged).toEqual([
      { code: "A", message: "Alpha" },
      { code: "B", message: "Beta" },
    ])
  })
})
