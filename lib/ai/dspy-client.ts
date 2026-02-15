import { dspyEnv } from "@/lib/env"
import {
  type EvidenceSnapshot,
  llmVerifierResultSchema,
} from "@/lib/ai/draft"
import { z } from "zod"

const serviceErrorSchema = z.object({
  error: z.string().min(1),
  message: z.string().min(1),
})

const processReviewResponseSchema = z.object({
  decision: z.enum(["READY", "BLOCKED_BY_VERIFIER"]),
  draftText: z.string().min(1),
  verifier: llmVerifierResultSchema,
  seoQuality: z.object({
    keywordCoverage: z.number().min(0).max(1),
    requiredKeywordUsed: z.boolean(),
    requiredKeywordCoverage: z.number().min(0).max(1),
    optionalKeywordCoverage: z.number().min(0).max(1),
    geoTermUsed: z.boolean(),
    geoTermOveruse: z.boolean(),
    stuffingRisk: z.boolean(),
    keywordMentions: z.number().int().min(0),
    missingRequiredKeywords: z.array(z.string()),
  }),
  generation: z.object({
    attempted: z.boolean(),
    changed: z.boolean(),
    attemptCount: z.number().int().min(1),
  }),
  program: z.object({
    version: z.string().min(1),
    draftArtifactVersion: z.string().min(1),
    verifyArtifactVersion: z.string().min(1),
  }),
  models: z.object({
    draft: z.string().min(1),
    verify: z.string().min(1),
  }),
  trace: z.object({
    // The service may omit draftTraceId (or return null) for verify-only flows.
    draftTraceId: z.string().min(1).nullable().optional(),
    verifyTraceId: z.string().min(1),
  }),
  latencyMs: z.number().int().min(0),
})

export type DspyProcessMode = "AUTO" | "MANUAL_REGENERATE" | "VERIFY_EXISTING_DRAFT"

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

export async function processReviewWithDspy(input: {
  orgId: string
  reviewId: string
  mode: DspyProcessMode
  evidence: EvidenceSnapshot
  currentDraftText?: string
  candidateDraftText?: string
  requestId?: string
  experimentId?: string
  programVersion?: string
  draftModel?: string
  verifyModel?: string
  signal?: AbortSignal
}) {
  const execution = buildExecutionPayload(input)
  const res = await callDspy("api/review/process", {
    orgId: input.orgId,
    reviewId: input.reviewId,
    mode: input.mode,
    evidence: input.evidence,
    currentDraftText: input.currentDraftText,
    candidateDraftText: input.candidateDraftText,
    requestId: input.requestId,
    ...(execution ? { execution } : {}),
  }, { signal: input.signal })
  const parsed = processReviewResponseSchema.safeParse(res)
  if (!parsed.success) {
    throw new DspyServiceError(
      "MODEL_SCHEMA_ERROR",
      502,
      `DSPy process response schema error: ${parsed.error.message}`,
    )
  }
  return parsed.data
}

function buildExecutionPayload(input: {
  experimentId?: string
  programVersion?: string
  draftModel?: string
  verifyModel?: string
}) {
  const experimentId = cleanOptionalString(input.experimentId)
  const programVersion = cleanOptionalString(input.programVersion)
  const draftModel = cleanOptionalString(input.draftModel)
  const verifyModel = cleanOptionalString(input.verifyModel)

  if (!experimentId && !programVersion && !draftModel && !verifyModel) {
    return null
  }

  return {
    experimentId,
    programVersion,
    draftModel,
    verifyModel,
  }
}

function cleanOptionalString(value: string | undefined) {
  if (!value) return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

async function callDspy(path: string, payload: unknown, opts?: { signal?: AbortSignal }) {
  const e = dspyEnv()
  const baseUrl = e.DSPY_SERVICE_BASE_URL.replace(/\/+$/, "")
  const timeoutMs = e.DSPY_HTTP_TIMEOUT_MS ?? 12_000

  const controller = new AbortController()
  const parentSignal = opts?.signal
  const onParentAbort = () => controller.abort()
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort()
    else parentSignal.addEventListener("abort", onParentAbort, { once: true })
  }
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
      if (parentSignal?.aborted) {
        throw new DspyServiceError("MODEL_TIMEOUT", 504, "DSPy request cancelled due to execution budget.")
      }
      throw new DspyServiceError(
        "MODEL_TIMEOUT",
        504,
        `DSPy service timed out after ${timeoutMs}ms`,
      )
    }
    const unavailable = asUnavailableServiceError(err, baseUrl)
    if (unavailable) throw unavailable
    throw new DspyServiceError(
      "INTERNAL_ERROR",
      502,
      err instanceof Error ? err.message : String(err),
    )
  } finally {
    clearTimeout(timeout)
    parentSignal?.removeEventListener("abort", onParentAbort)
  }
}

function asUnavailableServiceError(err: unknown, baseUrl: string): DspyServiceError | null {
  const code = readNetworkErrorCode(err)
  if (code && isUnavailableNetworkCode(code)) {
    return new DspyServiceError(
      "INTERNAL_ERROR",
      503,
      `DSPy service unavailable at ${baseUrl}.`,
    )
  }

  if (err instanceof Error && err.message.toLowerCase().includes("fetch failed")) {
    return new DspyServiceError(
      "INTERNAL_ERROR",
      503,
      `DSPy service unavailable at ${baseUrl}.`,
    )
  }

  return null
}

function readNetworkErrorCode(err: unknown): string | null {
  if (!(err instanceof Error)) return null
  const cause = (err as Error & { cause?: unknown }).cause
  if (!cause || typeof cause !== "object") return null
  const code = (cause as { code?: unknown }).code
  return typeof code === "string" && code.trim().length > 0 ? code : null
}

function isUnavailableNetworkCode(code: string) {
  return [
    "ECONNREFUSED",
    "ECONNRESET",
    "EHOSTUNREACH",
    "ENETUNREACH",
    "ENOTFOUND",
    "ETIMEDOUT",
  ].includes(code)
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
