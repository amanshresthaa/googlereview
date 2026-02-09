import { describe, expect, test } from "vitest"
import { buildReviewCountsWhere, buildReviewWhere, decodeReviewsCursor, encodeReviewsCursor } from "@/lib/reviews/listing"

describe("reviews cursor", () => {
  test("roundtrip encode/decode", () => {
    const c = { t: new Date("2026-02-09T00:00:00.000Z").toISOString(), id: "abc" }
    const enc = encodeReviewsCursor(c)
    const dec = decodeReviewsCursor(enc)
    expect(dec).toEqual(c)
  })

  test("rejects invalid cursor", () => {
    expect(() => decodeReviewsCursor("not-base64")).toThrow("BAD_CURSOR")
  })
})

describe("where builders", () => {
  test("unanswered includes enabled locations", () => {
    expect(buildReviewWhere({ orgId: "o1", filter: "unanswered" })).toEqual({
      orgId: "o1",
      location: { enabled: true },
      googleReplyComment: null,
    })
  })

  test("urgent includes unanswered + rating <=2", () => {
    expect(buildReviewWhere({ orgId: "o1", filter: "urgent" })).toEqual({
      orgId: "o1",
      location: { enabled: true },
      googleReplyComment: null,
      starRating: { lte: 2 },
    })
  })

  test("mentions requires mention (builder returns deterministic invalid marker otherwise)", () => {
    expect(buildReviewWhere({ orgId: "o1", filter: "mentions", mention: "cold" })).toEqual({
      orgId: "o1",
      location: { enabled: true },
      mentions: { has: "cold" },
    })
    expect(buildReviewWhere({ orgId: "o1", filter: "mentions" })).toEqual({
      orgId: "o1",
      location: { enabled: true },
      id: "__INVALID__",
    })
  })

  test("counts where uses enabled locations", () => {
    expect(buildReviewCountsWhere({ orgId: "o1", key: "mentions_total" })).toEqual({
      orgId: "o1",
      location: { enabled: true },
      mentions: { isEmpty: false },
    })
  })
})

