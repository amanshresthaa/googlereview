import { describe, expect, it } from "vitest"

<<<<<<< ours
<<<<<<< ours
import { buildVerifierResultEnvelope } from "@/lib/reviews/verifier-envelope"
=======
=======
>>>>>>> theirs
import {
  VERIFIER_RESULT_SCHEMA_VERSION,
  buildVerifierResultEnvelope,
  parseVerifierResultEnvelope,
  unwrapVerifierResultPayload,
} from "@/lib/reviews/verifier-envelope"
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
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

<<<<<<< ours
<<<<<<< ours
=======
=======
>>>>>>> theirs
  it("rejects strict envelope parsing for unknown schema versions but keeps loose backward compatibility", () => {
    const payload = {
      schemaVersion: VERIFIER_RESULT_SCHEMA_VERSION + 1,
      decisionSource: "DSPY_VERIFIER",
      payload: {
        issues: ["Should not be unwrapped"],
      },
    }

    expect(parseVerifierResultEnvelope(payload)).toBeNull()
    expect(unwrapVerifierResultPayload(payload)).toBeNull()
    expect(extractVerifierIssueMessages(payload)).toEqual(["Should not be unwrapped"])
    expect(getFirstVerifierIssueMessage(payload)).toBe("Should not be unwrapped")
  })

  it("rejects malformed envelope shapes while preserving loose top-level and nested parsing", () => {
    const payload = {
      schemaVersion: VERIFIER_RESULT_SCHEMA_VERSION,
      decisionSource: 42,
      payload: {
        issues: ["Should not be read from malformed envelope"],
      },
      issues: ["Legacy issue survives"],
      dspy: { verifier: { violations: [{ message: "Legacy DSPy violation" }] } },
    }

    expect(parseVerifierResultEnvelope(payload)).toBeNull()
    expect(unwrapVerifierResultPayload(payload)).toBeNull()
    expect(extractVerifierIssueMessages(payload)).toEqual([
      "Legacy issue survives",
      "Legacy DSPy violation",
      "Should not be read from malformed envelope",
    ])
  })

  it("rejects envelope payloads with invalid payload shape", () => {
    const payload = {
      schemaVersion: VERIFIER_RESULT_SCHEMA_VERSION,
      decisionSource: "DSPY_VERIFIER",
      payload: ["not-an-object"],
    }

    expect(unwrapVerifierResultPayload(payload)).toBeNull()
    expect(extractVerifierIssueMessages(payload)).toEqual([])
  })

<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
  it("returns empty values safely for unknown payloads", () => {
    expect(extractVerifierIssueMessages(null)).toEqual([])
    expect(getFirstVerifierIssueMessage(null)).toBeNull()
  })
})
