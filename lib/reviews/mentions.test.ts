import { describe, expect, it } from "vitest"
import { extractMentionsAndHighlights } from "@/lib/reviews/mentions"

describe("extractMentionsAndHighlights", () => {
  it("returns empty for null/empty comments", () => {
    expect(extractMentionsAndHighlights(null, ["wait"])).toEqual({
      mentions: [],
      highlights: [],
    })
    expect(extractMentionsAndHighlights("", ["wait"])).toEqual({
      mentions: [],
      highlights: [],
    })
  })

  it("matches single-word keywords with word boundaries", () => {
    const comment = "We had to wait. Waiting was long, but the wait staff were kind."
    const r = extractMentionsAndHighlights(comment, ["wait"])
    // "wait" should match "wait" but not "Waiting".
    expect(r.mentions).toEqual(["wait"])
    expect(r.highlights.some((h) => comment.slice(h.start, h.end).toLowerCase() === "wait")).toBe(
      true
    )
    expect(r.highlights.some((h) => comment.slice(h.start, h.end).toLowerCase() === "waiting")).toBe(
      false
    )
  })

  it("matches phrases as substrings", () => {
    const comment = "They delivered the wrong order twice."
    const r = extractMentionsAndHighlights(comment, ["wrong order"])
    expect(r.mentions).toEqual(["wrong order"])
    expect(r.highlights.length).toBe(1)
    expect(comment.slice(r.highlights[0]!.start, r.highlights[0]!.end)).toBe("wrong order")
  })
})

