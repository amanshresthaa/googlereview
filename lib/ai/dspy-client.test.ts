import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  DspyServiceError,
  processReviewWithDspy,
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
  seoProfile: {
    primaryKeywords: ["tikka masala"],
    secondaryKeywords: ["indian restaurant", "family dinner"],
    geoTerms: ["austin"],
  },
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
            decision: "READY",
            draftText: "Thanks so much for your review!",
            verifier: {
              pass: true,
              violations: [],
              suggestedRewrite: null,
            },
            seoQuality: {
              keywordCoverage: 0.82,
              requiredKeywordUsed: true,
              requiredKeywordCoverage: 1,
              optionalKeywordCoverage: 0.5,
              geoTermUsed: true,
              geoTermOveruse: false,
              stuffingRisk: false,
              keywordMentions: 2,
              missingRequiredKeywords: [],
            },
            generation: {
              attempted: true,
              changed: true,
              attemptCount: 1,
            },
            program: {
              version: "v2026-02-11",
              draftArtifactVersion: "draft_program.json:abc123def456",
              verifyArtifactVersion: "verify_program.json:112233445566",
            },
            models: {
              draft: "openai/gpt-4o-mini",
              verify: "openai/gpt-4.1-mini",
            },
            trace: {
              draftTraceId: "trace-1-draft",
              verifyTraceId: "trace-1-verify",
            },
            latencyMs: 211,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      )

    const result = await processReviewWithDspy({
      orgId: "org_1",
      reviewId: "rev_1",
      mode: "MANUAL_REGENERATE",
      evidence,
      currentDraftText: "Thanks for your review.",
      experimentId: "exp-canary-2026w07",
      programVersion: "canary-v2",
      draftModel: "openai/gpt-4.1-mini",
      verifyModel: "openai/gpt-4.1-mini",
    })

    expect(result.draftText).toContain("Thanks")
    expect(result.decision).toBe("READY")
    expect(result.program.version).toBe("v2026-02-11")
    expect(result.models.draft).toBe("openai/gpt-4o-mini")
    expect(result.trace.verifyTraceId).toBe("trace-1-verify")
    expect(result.seoQuality.keywordCoverage).toBe(0.82)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://dspy.example.com/api/review/process")
    expect(init?.method).toBe("POST")
    expect((init?.headers as Record<string, string>).authorization).toBe("Bearer shared-token")
    expect(typeof init?.body).toBe("string")
    const payload = JSON.parse(String(init?.body)) as {
      mode: string
      currentDraftText?: string
      execution?: {
        experimentId?: string
        programVersion?: string
        draftModel?: string
        verifyModel?: string
      }
    }
    expect(payload.mode).toBe("MANUAL_REGENERATE")
    expect(payload.currentDraftText).toBe("Thanks for your review.")
    expect(payload.execution?.experimentId).toBe("exp-canary-2026w07")
    expect(payload.execution?.programVersion).toBe("canary-v2")
    expect(payload.execution?.draftModel).toBe("openai/gpt-4.1-mini")
    expect(payload.execution?.verifyModel).toBe("openai/gpt-4.1-mini")
  })

  it("accepts verify-existing result payload", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          decision: "BLOCKED_BY_VERIFIER",
          draftText: "Thank you for dining with us!",
            verifier: {
              pass: false,
              violations: [{ code: "FACTUALITY", message: "Contains unsupported claim." }],
              suggestedRewrite: "Thank you for visiting us. We appreciate your feedback.",
            },
            seoQuality: {
              keywordCoverage: 0.35,
              requiredKeywordUsed: false,
              requiredKeywordCoverage: 0,
              optionalKeywordCoverage: 0.5,
              geoTermUsed: false,
              geoTermOveruse: false,
              stuffingRisk: false,
              keywordMentions: 1,
              missingRequiredKeywords: ["tikka masala"],
            },
            generation: {
              attempted: false,
              changed: false,
              attemptCount: 1,
            },
            program: {
              version: "v2026-02-11",
              draftArtifactVersion: "draft_program.json:abc123def456",
              verifyArtifactVersion: "verify_program.json:112233445566",
            },
          models: {
            draft: "openai/gpt-4o-mini",
            verify: "openai/gpt-4.1-mini",
          },
          trace: {
            verifyTraceId: "trace-verify",
          },
          latencyMs: 145,
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    )

    const result = await processReviewWithDspy({
      orgId: "org_1",
      reviewId: "rev_1",
      mode: "VERIFY_EXISTING_DRAFT",
      evidence,
      candidateDraftText: "Thank you for dining with us!",
    })

    expect(result.decision).toBe("BLOCKED_BY_VERIFIER")
    expect(result.verifier.pass).toBe(false)
    expect(result.generation.attempted).toBe(false)
    expect(result.seoQuality.requiredKeywordUsed).toBe(false)
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
      processReviewWithDspy({ orgId: "org_1", reviewId: "rev_1", mode: "AUTO", evidence }),
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
      processReviewWithDspy({
        orgId: "org_1",
        reviewId: "rev_1",
        mode: "VERIFY_EXISTING_DRAFT",
        evidence,
        candidateDraftText: "Thanks for visiting.",
      }),
    ).rejects.toMatchObject({
      name: "DspyServiceError",
      code: "MODEL_SCHEMA_ERROR",
      status: 502,
    } satisfies Partial<DspyServiceError>)
  })

  it("maps caller-side abort to timeout error", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal
        if (!signal) {
          reject(new Error("Missing signal"))
          return
        }
        signal.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        )
      }) as Promise<Response>
    })

    const controller = new AbortController()
    const pending = processReviewWithDspy({
      orgId: "org_1",
      reviewId: "rev_1",
      mode: "AUTO",
      evidence,
      signal: controller.signal,
    })

    controller.abort()

    await expect(pending).rejects.toMatchObject({
      name: "DspyServiceError",
      code: "MODEL_TIMEOUT",
      status: 504,
    } satisfies Partial<DspyServiceError>)
  })

  it("maps network-unreachable fetch failures to service unavailable", async () => {
    const unreachable = new TypeError("fetch failed")
    ;(unreachable as TypeError & { cause?: unknown }).cause = { code: "ECONNREFUSED" }
    vi.spyOn(globalThis, "fetch").mockRejectedValue(unreachable)

    await expect(
      processReviewWithDspy({
        orgId: "org_1",
        reviewId: "rev_1",
        mode: "AUTO",
        evidence,
      }),
    ).rejects.toMatchObject({
      name: "DspyServiceError",
      code: "INTERNAL_ERROR",
      status: 503,
    } satisfies Partial<DspyServiceError>)
  })
})
