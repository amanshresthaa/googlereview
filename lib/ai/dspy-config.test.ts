import { describe, expect, it } from "vitest"

import { parseStoredDspyConfig, resolveDspyExecution } from "@/lib/ai/dspy-config"

describe("dspy config", () => {
  it("parses valid stored config and drops invalid payloads", () => {
    const valid = parseStoredDspyConfig({
      programVersion: "  stable-v1  ",
      experiments: [
        {
          id: "exp-a",
          trafficPercent: 50,
        },
      ],
    })
    expect(valid?.programVersion).toBe("stable-v1")
    expect(valid?.experiments?.[0]?.id).toBe("exp-a")

    const invalid = parseStoredDspyConfig({ experiments: [{ id: "", trafficPercent: 10 }] })
    expect(invalid).toBeNull()
  })

  it("applies location defaults over org defaults", () => {
    const resolved = resolveDspyExecution({
      orgId: "org-1",
      reviewId: "review-1",
      orgConfig: {
        programVersion: "org-program",
        draftModel: "openai/gpt-4o-mini",
        verifyModel: "openai/gpt-4.1-mini",
      },
      locationConfig: {
        programVersion: "location-program",
        verifyModel: "openai/gpt-4.1",
      },
    })

    expect(resolved.experimentId).toBeNull()
    expect(resolved.effective.programVersion).toBe("location-program")
    expect(resolved.effective.draftModel).toBe("openai/gpt-4o-mini")
    expect(resolved.effective.verifyModel).toBe("openai/gpt-4.1")
  })

  it("assigns experiment deterministically and applies experiment overrides", () => {
    const resolved = resolveDspyExecution({
      orgId: "org-2",
      reviewId: "review-2",
      orgConfig: {
        programVersion: "stable-program",
        draftModel: "openai/gpt-4o-mini",
        verifyModel: "openai/gpt-4.1-mini",
        experiments: [
          {
            id: "canary-exp",
            trafficPercent: 100,
            programVersion: "canary-program",
            draftModel: "openai/gpt-4.1-mini",
          },
        ],
      },
      locationConfig: null,
    })

    expect(resolved.experimentId).toBe("canary-exp")
    expect(resolved.snapshot.experiment?.id).toBe("canary-exp")
    expect(resolved.effective.programVersion).toBe("canary-program")
    expect(resolved.effective.draftModel).toBe("openai/gpt-4.1-mini")
    expect(resolved.effective.verifyModel).toBe("openai/gpt-4.1-mini")
  })

  it("prefers location experiment roster when provided", () => {
    const resolved = resolveDspyExecution({
      orgId: "org-3",
      reviewId: "review-3",
      orgConfig: {
        experiments: [{ id: "org-exp", trafficPercent: 100, programVersion: "org-program" }],
      },
      locationConfig: {
        experiments: [{ id: "loc-exp", trafficPercent: 100, programVersion: "loc-program" }],
      },
    })

    expect(resolved.experimentId).toBe("loc-exp")
    expect(resolved.effective.programVersion).toBe("loc-program")
  })
})
