import { describe, expect, it } from "vitest"
import { runDeterministicVerifier } from "@/lib/verifier/deterministic"

describe("runDeterministicVerifier", () => {
  it("fails empty drafts", () => {
    const r = runDeterministicVerifier({ evidenceText: "ok", draftText: "   " })
    expect(r.pass).toBe(false)
    expect(r.violations.some((v) => v.code === "EMPTY_DRAFT")).toBe(true)
  })

  it("blocks action claims when not present in evidence", () => {
    const r = runDeterministicVerifier({
      evidenceText: "Food was cold.",
      draftText: "We’ve fixed the issue and retrained our staff.",
    })
    expect(r.pass).toBe(false)
    expect(r.violations.some((v) => v.code === "ACTION_CLAIM")).toBe(true)
  })

  it("does not block when the evidence contains the same phrase", () => {
    const r = runDeterministicVerifier({
      evidenceText: "We fixed it already, so I'm updating my review.",
      draftText: "We fixed it already, and we appreciate you updating your review.",
    })
    // Deterministic verifier should not block; LLM verifier still runs separately.
    expect(r.pass).toBe(true)
  })
})

