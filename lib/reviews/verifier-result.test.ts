import { describe, expect, it } from "vitest"

import { buildVerifierResultEnvelope } from "@/lib/reviews/verifier-envelope"
import { extractVerifierIssueMessages, getFirstVerifierIssueMessage } from "@/lib/reviews/verifier-result"

describe("verifier-result", () => {
  it("collects issues from the versioned envelope payload", () => {
    const payload = buildVerifierResultEnvelope({
      decisionSource: "DSPY_VERIFIER",
      payload: {
        issues: ["Top-level issue"],
        dspy: {
          verifier: {
            violations: [{ code: "DSPY", message: "DSPy violation" }],
          },
        },
        policy: {
          localViolations: [{ code: "LOCAL", message: "Policy violation" }],
        },
      },
    })

    expect(extractVerifierIssueMessages(payload)).toEqual([
      "Top-level issue",
      "DSPy violation",
      "Policy violation",
    ])
    expect(getFirstVerifierIssueMessage(payload)).toBe("Top-level issue")
  })

  it("retains backward compatibility for legacy payload shape", () => {
    const payload = {
      issues: ["Top-level issue"],
      dspy: {
        verifier: {
          violations: [{ message: "DSPy violation" }],
        },
      },
      policy: {
        localViolations: [{ message: "Policy violation" }],
      },
    }

    expect(extractVerifierIssueMessages(payload)).toEqual(["Top-level issue", "DSPy violation", "Policy violation"])
  })

  it("returns empty values safely for unknown payloads", () => {
    expect(extractVerifierIssueMessages(null)).toEqual([])
    expect(getFirstVerifierIssueMessage(null)).toBeNull()
  })
})
