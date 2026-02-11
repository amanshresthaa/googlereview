import { NextResponse } from "next/server"
import type { ApiErrorCode } from "@/lib/api/errors"
import { stableJsonStringify } from "@/lib/api/json"

export type ApiResponseInit = {
  status?: number
  headers?: HeadersInit
}

export function mergeHeaders(...inits: Array<HeadersInit | undefined>) {
  const h = new Headers()
  for (const init of inits) {
    if (!init) continue
    const next = new Headers(init)
    for (const [k, v] of next.entries()) h.set(k, v)
  }
  return h
}

export function jsonResponse(input: {
  status: number
  headers: HeadersInit
  body: unknown
}) {
  const bodyText = stableJsonStringify(input.body)
  const headers = mergeHeaders(input.headers, { "content-type": "application/json; charset=utf-8" })
  return new NextResponse(bodyText, { status: input.status, headers })
}

export function okJson(input: {
  requestId: string
  body: Record<string, unknown>
  init?: ApiResponseInit
}) {
  const merged: Record<string, unknown> = { ...input.body, ok: true, requestId: input.requestId }
  const headers = mergeHeaders(input.init?.headers, { "X-Request-Id": input.requestId })
  return jsonResponse({ status: input.init?.status ?? 200, headers, body: merged })
}

export function errJson(input: {
  requestId: string
  status: number
  code: ApiErrorCode
  message: string
  details?: unknown
  fields?: Record<string, string[]>
  init?: ApiResponseInit
}) {
  const body: Record<string, unknown> = {
    ok: false,
    requestId: input.requestId,
    error: input.code,
    message: input.message,
  }
  if (input.details !== undefined) body.details = input.details
  if (input.fields) body.fields = input.fields
  const headers = mergeHeaders(input.init?.headers, { "X-Request-Id": input.requestId })
  return jsonResponse({ status: input.status, headers, body })
}

