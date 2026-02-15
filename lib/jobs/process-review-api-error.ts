import { ApiError } from "@/lib/api/errors"

type ProcessReviewOperation = "generation" | "verification"

type ProcessReviewFailureInput = {
  operation: ProcessReviewOperation
  lastErrorCode: string | null
  lastError: string | null
  lastErrorMetaJson?: unknown
}

type ErrorMeta = {
  httpStatus?: unknown
  retryAfterSec?: unknown
}

function operationLabel(operation: ProcessReviewOperation) {
  return operation === "generation" ? "Draft generation" : "Draft verification"
}

function asErrorMeta(value: unknown): ErrorMeta | null {
  if (!value || typeof value !== "object") return null
  return value as ErrorMeta
}

function readHttpStatus(meta: ErrorMeta | null): number | null {
  if (!meta) return null
  const status = meta.httpStatus
  if (typeof status !== "number" || !Number.isFinite(status)) return null
  return Math.trunc(status)
}

function readRetryAfterSec(meta: ErrorMeta | null): number | null {
  if (!meta) return null
  const retryAfterSec = meta.retryAfterSec
  if (typeof retryAfterSec !== "number" || !Number.isFinite(retryAfterSec) || retryAfterSec <= 0) {
    return null
  }
  return Math.trunc(retryAfterSec)
}

function buildUnavailableError(operation: ProcessReviewOperation, retryAfterSec: number | null) {
  return new ApiError({
    status: 503,
    code: "UPSTREAM_5XX",
    message: `${operationLabel(operation)} is temporarily unavailable. Please retry.`,
    details: retryAfterSec ? { retryAfterSec } : undefined,
  })
}

export function processReviewFailureToApiError(input: ProcessReviewFailureInput): ApiError {
  const fallbackMessage =
    input.lastErrorCode ?? input.lastError ?? `${operationLabel(input.operation)} failed.`
  const code = (input.lastErrorCode ?? "").trim().toUpperCase()
  const meta = asErrorMeta(input.lastErrorMetaJson)
  const upstreamStatus = readHttpStatus(meta)
  const retryAfterSec = readRetryAfterSec(meta)
  const timeoutMessage = `${operationLabel(input.operation)} timed out. Please retry.`

  if (code === "BUDGET_EXCEEDED") {
    return new ApiError({
      status: 429,
      code: "BUDGET_EXCEEDED",
      message: "Daily AI budget exceeded for this organization.",
    })
  }
  if (code === "COOLDOWN_ACTIVE") {
    return new ApiError({
      status: 429,
      code: "COOLDOWN_ACTIVE",
      message: `${operationLabel(input.operation)} is cooling down. Please retry shortly.`,
      details: retryAfterSec ? { retryAfterSec } : undefined,
    })
  }
  if (code === "DRAFT_STALE") {
    return new ApiError({
      status: 409,
      code: "DRAFT_STALE",
      message: "Draft is stale. Refresh and retry.",
    })
  }
  if (code === "NO_DRAFT") {
    return new ApiError({
      status: 400,
      code: "NO_DRAFT",
      message: "No draft available for this review.",
    })
  }
  if (code === "NOT_FOUND") {
    return new ApiError({
      status: 404,
      code: "NOT_FOUND",
      message: "Review not found.",
    })
  }
  if (code === "FORBIDDEN") {
    return new ApiError({
      status: 403,
      code: "FORBIDDEN",
      message: "Forbidden.",
    })
  }
  if (code === "BAD_REQUEST" || code === "DSPY_INVALID_REQUEST") {
    return new ApiError({
      status: 400,
      code: "BAD_REQUEST",
      message: `${operationLabel(input.operation)} request was rejected.`,
    })
  }
  if (code === "DSPY_RATE_LIMIT" || code === "UPSTREAM_RATE_LIMITED") {
    return new ApiError({
      status: 429,
      code: "UPSTREAM_RATE_LIMITED",
      message: "AI provider rate limit reached. Please retry shortly.",
      details: retryAfterSec ? { retryAfterSec } : undefined,
    })
  }
  if (code === "DSPY_MODEL_TIMEOUT" || code === "UPSTREAM_TIMEOUT" || code === "FASTPATH_TIMEOUT") {
    return new ApiError({
      status: 504,
      code: "UPSTREAM_TIMEOUT",
      message: timeoutMessage,
      details: retryAfterSec ? { retryAfterSec } : undefined,
    })
  }
  if (code === "DSPY_SCHEMA_ERROR") {
    return new ApiError({
      status: 502,
      code: "UPSTREAM_5XX",
      message: "AI service response schema mismatch.",
    })
  }
  if (code === "DSPY_INTERNAL" || code === "UPSTREAM_5XX") {
    if (upstreamStatus === 429) {
      return new ApiError({
        status: 429,
        code: "UPSTREAM_RATE_LIMITED",
        message: "AI provider rate limit reached. Please retry shortly.",
        details: retryAfterSec ? { retryAfterSec } : undefined,
      })
    }
    if (upstreamStatus === 504 || upstreamStatus === 408) {
      return new ApiError({
        status: 504,
        code: "UPSTREAM_TIMEOUT",
        message: timeoutMessage,
        details: retryAfterSec ? { retryAfterSec } : undefined,
      })
    }
    return buildUnavailableError(input.operation, retryAfterSec)
  }

  return new ApiError({
    status: 500,
    code: "INTERNAL",
    message: fallbackMessage,
  })
}
