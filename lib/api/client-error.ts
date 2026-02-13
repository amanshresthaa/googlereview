type ClientErrorPayload = {
  message?: unknown
  error?: unknown
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) return null
  return value as Record<string, unknown>
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function extractClientErrorMessage(params: {
  body: unknown
  statusText: string
  fallback?: string
}) {
  const { body, statusText, fallback = "Request failed" } = params
  const payload = toRecord(body) as ClientErrorPayload | null

  const message = toNonEmptyString(payload?.message)
  if (message) return message

  const error = toNonEmptyString(payload?.error)
  if (error) return error

  return toNonEmptyString(statusText) ?? fallback
}
