import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  DspyServiceError,
  generateDraftWithDspy,
  verifyDraftWithDspy,
} from "@/lib/ai/dspy-client"
import type { EvidenceSnapshot } from "@/lib/ai/draft"

vi.mock("@/lib/env", () => ({
  dspyEnv: () => ({
    DSPY_SERVICE_BASE_URL: "https://dspy.example.com",
    DSPY_SERVICE_TOKEN: "shared-token",
    DSPY_HTTP_TIMEOUT_MS: 12000,
  }),
}))

const evidence: EvidenceSnapshot = {
  starRating: 5,
  comment: "Great dinner and friendly staff.",
  reviewerDisplayName: "Alex",
  reviewerIsAnonymous: false,
  locationDisplayName: "Lapen Inn",
  createTime: "2026-02-11T00:00:00.000Z",
  highlights: [{ start: 0, end: 12, label: "praise" }],
  mentionKeywords: ["staff", "food"],
  tone: {
    preset: "friendly",
    customInstructions: null,
  },
}

describe("dspy client", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("generates draft text from DSPy service", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            draftText: "Thanks so much for your review!",
            model: "openai/gpt-4o-mini",
            traceId: "trace-1",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      )

    const result = await generateDraftWithDspy({
      orgId: "org_1",
      reviewId: "rev_1",
      evidence,
      previousDraftText: "Thanks for your review.",
      regenerationAttempt: 2,
    })

    expect(result.draftText).toContain("Thanks")
    expect(result.model).toBe("openai/gpt-4o-mini")
    expect(result.traceId).toBe("trace-1")

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://dspy.example.com/api/draft/generate")
    expect(init?.method).toBe("POST")
    expect((init?.headers as Record<string, string>).authorization).toBe("Bearer shared-token")
    expect(typeof init?.body).toBe("string")
    const payload = JSON.parse(String(init?.body)) as {
      previousDraftText?: string
      regenerationAttempt?: number
    }
    expect(payload.previousDraftText).toBe("Thanks for your review.")
    expect(payload.regenerationAttempt).toBe(2)
  })

  it("normalizes null suggestedRewrite from verify response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          pass: true,
          violations: [],
          suggestedRewrite: null,
          model: "openai/gpt-4.1-mini",
          traceId: "trace-2",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    )

    const result = await verifyDraftWithDspy({
      orgId: "org_1",
      reviewId: "rev_1",
      evidence,
      draftText: "Thank you for dining with us!",
    })

    expect(result.pass).toBe(true)
    expect(result.violations).toEqual([])
    expect(result.suggestedRewrite).toBeUndefined()
  })

  it("maps service error code from non-2xx response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "MODEL_RATE_LIMIT",
          message: "Too many requests",
        }),
        {
          status: 429,
          headers: { "content-type": "application/json" },
        },
      ),
    )

    await expect(
      generateDraftWithDspy({ orgId: "org_1", reviewId: "rev_1", evidence }),
    ).rejects.toMatchObject({
      name: "DspyServiceError",
      code: "MODEL_RATE_LIMIT",
      status: 429,
    } satisfies Partial<DspyServiceError>)
  })

  it("fails closed on malformed response schema", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          pass: "not-a-boolean",
          violations: [],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    )

    await expect(
      verifyDraftWithDspy({
        orgId: "org_1",
        reviewId: "rev_1",
        evidence,
        draftText: "Thanks for visiting.",
      }),
    ).rejects.toMatchObject({
      name: "DspyServiceError",
      code: "MODEL_SCHEMA_ERROR",
      status: 502,
    } satisfies Partial<DspyServiceError>)
  })
})
