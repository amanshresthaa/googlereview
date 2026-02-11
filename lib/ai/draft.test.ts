import { describe, expect, it } from "vitest"

import { areDraftTextsEquivalent } from "@/lib/ai/draft"

describe("areDraftTextsEquivalent", () => {
  it("treats punctuation-only differences as equivalent", () => {
    const previous = "Thanks for visiting us! We appreciate your feedback."
    const next = "Thanks for visiting us. We appreciate your feedback"

    expect(areDraftTextsEquivalent(previous, next)).toBe(true)
  })

  it("treats wording changes as different", () => {
    const previous = "Thanks for visiting us! We appreciate your feedback."
    const next = "We appreciate your visit and hope to welcome you back soon."

    expect(areDraftTextsEquivalent(previous, next)).toBe(false)
  })
})
