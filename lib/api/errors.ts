export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "BAD_REQUEST"
  | "NOT_FOUND"
  | "ALREADY_REPLIED"
  | "NO_DRAFT"
  | "BAD_CURSOR"
  | "BULK_APPROVE_DISABLED"
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "IDEMPOTENCY_KEY_REUSED"
  | "IDEMPOTENCY_SCOPE_MISMATCH"
  | "RATE_LIMITED"
  | "COOLDOWN_ACTIVE"
  | "BUDGET_EXCEEDED"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_RATE_LIMITED"
  | "UPSTREAM_5XX"
  | "UPSTREAM_4XX"
  | "DRAFT_NOT_READY"
  | "DRAFT_STALE"
  | "INTERNAL"
  | "IDEMPOTENCY_STORAGE_FAILED"

export class ApiError extends Error {
  public readonly status: number
  public readonly code: ApiErrorCode
  public readonly details?: unknown
  public readonly fields?: Record<string, string[]>

  constructor(input: {
    status: number
    code: ApiErrorCode
    message: string
    details?: unknown
    fields?: Record<string, string[]>
  }) {
    super(input.message)
    this.name = "ApiError"
    this.status = input.status
    this.code = input.code
    this.details = input.details
    this.fields = input.fields
  }
}

