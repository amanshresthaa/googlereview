import { describe, expect, it } from "vitest"

import { processReviewFailureToApiError } from "@/lib/jobs/process-review-api-error"

describe("processReviewFailureToApiError", () => {
  it("maps DSPY_INTERNAL to upstream unavailable semantics", () => {
    const error = processReviewFailureToApiError({
      operation: "generation",
      lastErrorCode: "DSPY_INTERNAL",
      lastError: "DSPY_INTERNAL",
      lastErrorMetaJson: { dspyCode: "INTERNAL_ERROR", httpStatus: 502 },
    })

    expect(error.status).toBe(503)
    expect(error.code).toBe("UPSTREAM_5XX")
    expect(error.message).toContain("temporarily unavailable")
  })

  it("maps DSPY_MODEL_TIMEOUT to upstream timeout", () => {
    const error = processReviewFailureToApiError({
      operation: "verification",
      lastErrorCode: "DSPY_MODEL_TIMEOUT",
      lastError: "DSPY_MODEL_TIMEOUT",
      lastErrorMetaJson: { retryAfterSec: 8 },
    })

    expect(error.status).toBe(504)
    expect(error.code).toBe("UPSTREAM_TIMEOUT")
    expect(error.message).toContain("timed out")
  })

  it("maps BUDGET_EXCEEDED to a dedicated 429", () => {
    const error = processReviewFailureToApiError({
      operation: "generation",
      lastErrorCode: "BUDGET_EXCEEDED",
      lastError: "BUDGET_EXCEEDED",
    })

    expect(error.status).toBe(429)
    expect(error.code).toBe("BUDGET_EXCEEDED")
  })
})
