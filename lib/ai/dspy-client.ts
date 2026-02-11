import { dspyEnv } from "@/lib/env"
import {
  type EvidenceSnapshot,
  llmVerifierResultSchema,
  normalizeLlmVerifierResult,
} from "@/lib/ai/draft"
import { z } from "zod"

const serviceErrorSchema = z.object({
  error: z.string().min(1),
  message: z.string().min(1),
})

const generateDraftResponseSchema = z.object({
  draftText: z.string().min(1),
  model: z.string().optional(),
  traceId: z.string().optional(),
})

const verifyDraftResponseSchema = z.object({
  pass: z.boolean(),
  violations: z.array(
    z.object({
      code: z.string().min(1),
      message: z.string().min(1),
      snippet: z.string().optional(),
    }),
  ),
  suggestedRewrite: z.union([z.string(), z.null()]).optional(),
  model: z.string().optional(),
  traceId: z.string().optional(),
})

type DspyErrorCode =
  | "INVALID_REQUEST"
  | "MODEL_TIMEOUT"
  | "MODEL_RATE_LIMIT"
  | "MODEL_SCHEMA_ERROR"
  | "INTERNAL_ERROR"

export class DspyServiceError extends Error {
  readonly code: DspyErrorCode
  readonly status: number

  constructor(code: DspyErrorCode, status: number, message: string) {
    super(message)
    this.name = "DspyServiceError"
    this.code = code
    this.status = status
  }
}

export async function generateDraftWithDspy(input: {
  orgId: string
  reviewId: string
  evidence: EvidenceSnapshot
  previousDraftText?: string
  regenerationAttempt?: number
}) {
  const res = await callDspy("api/draft/generate", {
    orgId: input.orgId,
    reviewId: input.reviewId,
    evidence: input.evidence,
    previousDraftText: input.previousDraftText,
    regenerationAttempt: input.regenerationAttempt,
  })
  const parsed = generateDraftResponseSchema.safeParse(res)
  if (!parsed.success) {
    throw new DspyServiceError(
      "MODEL_SCHEMA_ERROR",
      502,
      `DSPy draft response schema error: ${parsed.error.message}`,
    )
  }
  return parsed.data
}

export async function verifyDraftWithDspy(input: {
  orgId: string
  reviewId: string
  evidence: EvidenceSnapshot
  draftText: string
}) {
  const res = await callDspy("api/draft/verify", {
    orgId: input.orgId,
    reviewId: input.reviewId,
    evidence: input.evidence,
    draftText: input.draftText,
  })
  const parsed = verifyDraftResponseSchema.safeParse(res)
  if (!parsed.success) {
    throw new DspyServiceError(
      "MODEL_SCHEMA_ERROR",
      502,
      `DSPy verify response schema error: ${parsed.error.message}`,
    )
  }

  return {
    ...normalizeLlmVerifierResult(llmVerifierResultSchema.parse(parsed.data)),
    model: parsed.data.model,
    traceId: parsed.data.traceId,
  }
}

async function callDspy(path: string, payload: unknown) {
  const e = dspyEnv()
  const baseUrl = e.DSPY_SERVICE_BASE_URL.replace(/\/+$/, "")
  const timeoutMs = e.DSPY_HTTP_TIMEOUT_MS ?? 12_000

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${baseUrl}/${path.replace(/^\/+/, "")}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${e.DSPY_SERVICE_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await parseErrorBody(res)
      throw new DspyServiceError(body.code, res.status, body.message)
    }

    return (await res.json()) as unknown
  } catch (err) {
    if (err instanceof DspyServiceError) throw err
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new DspyServiceError(
        "MODEL_TIMEOUT",
        504,
        `DSPy service timed out after ${timeoutMs}ms`,
      )
    }
    throw new DspyServiceError(
      "INTERNAL_ERROR",
      502,
      err instanceof Error ? err.message : String(err),
    )
  } finally {
    clearTimeout(timeout)
  }
}

async function parseErrorBody(res: Response): Promise<{ code: DspyErrorCode; message: string }> {
  const contentType = res.headers.get("content-type") ?? ""
  if (!contentType.includes("application/json")) {
    const text = await res.text()
    return {
      code: "INTERNAL_ERROR",
      message: text || `DSPy service error ${res.status}`,
    }
  }

  const json = (await res.json().catch(() => null)) as unknown
  const parsed = serviceErrorSchema.safeParse(json)
  if (!parsed.success) {
    return {
      code: "INTERNAL_ERROR",
      message: `DSPy service error ${res.status}`,
    }
  }

  const code = asDspyErrorCode(parsed.data.error)
  return { code, message: parsed.data.message }
}

function asDspyErrorCode(input: string): DspyErrorCode {
  if (input === "INVALID_REQUEST") return input
  if (input === "MODEL_TIMEOUT") return input
  if (input === "MODEL_RATE_LIMIT") return input
  if (input === "MODEL_SCHEMA_ERROR") return input
  return "INTERNAL_ERROR"
}
