export type JobErrorCode =
  | "BUDGET_EXCEEDED"
  | "COOLDOWN_ACTIVE"
  | "DRAFT_NOT_READY"
  | "DRAFT_STALE"
  | "ALREADY_REPLIED"
  | "NO_DRAFT"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "BAD_REQUEST"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_RATE_LIMITED"
  | "UPSTREAM_5XX"
  | "UPSTREAM_4XX"
  | "INTERNAL"

export class NonRetryableError extends Error {
  name = "NonRetryableError"
  public readonly code: JobErrorCode
  public readonly meta?: Record<string, unknown>

  constructor(code: JobErrorCode, message?: string, meta?: Record<string, unknown>) {
    super(message ?? code)
    this.code = code
    this.meta = meta
  }
}

export class RetryableJobError extends Error {
  name = "RetryableJobError"
  public readonly code: JobErrorCode
  public readonly meta?: Record<string, unknown>

  constructor(code: JobErrorCode, message?: string, meta?: Record<string, unknown>) {
    super(message ?? code)
    this.code = code
    this.meta = meta
  }
}

