import { ApiError } from "@/lib/api/errors"
import { okJson, errJson, jsonResponse, mergeHeaders } from "@/lib/api/response"
import { newRequestId } from "@/lib/api/json"
import { requireApiSession } from "@/lib/session"
import { consumeRateLimit, rateLimitHeaders } from "@/lib/api/rate-limit"
import type { RateLimitScope } from "@/lib/api/limits"
import { beginIdempotency, findReplay, findScopeMismatch, requestHash, storeIdempotencyResponse } from "@/lib/api/idempotency"
import { requireUuidV4 } from "@/lib/api/validation"
import { NextResponse } from "next/server"

export type ApiContext = {
  requestId: string
  url: URL
  path: string
}

export type AuthedApiContext = ApiContext & {
  session: NonNullable<Awaited<ReturnType<typeof requireApiSession>>>
}

type JsonBody = Record<string, unknown>

export async function handleAuthedGet(
  req: Request,
  handler: (ctx: AuthedApiContext) => Promise<{ status?: number; body: JsonBody; headers?: HeadersInit }>
) {
  const requestId = newRequestId()
  const url = new URL(req.url)
  const path = url.pathname

  const session = await requireApiSession()
  if (!session) {
    return errJson({ requestId, status: 401, code: "UNAUTHORIZED", message: "Unauthorized." })
  }

  try {
    const result = await handler({ requestId, url, path, session })
    return okJson({
      requestId,
      body: result.body,
      init: { status: result.status ?? 200, headers: mergeHeaders(result.headers, { "X-Request-Id": requestId }) },
    })
  } catch (err) {
    return apiErrorToResponse(err, requestId)
  }
}

export async function handleAuthedPost(
  req: Request,
  input: {
    rateLimitScope: RateLimitScope
    idempotency: {
      required: boolean
      semanticHeaders?: string[]
    }
    readBody?: boolean
  },
  handler: (ctx: AuthedApiContext & { body: unknown; rateLimitScope: RateLimitScope }) => Promise<{ status?: number; body: JsonBody; headers?: HeadersInit }>
) {
  const url = new URL(req.url)
  const path = url.pathname

  const session = await requireApiSession()
  const requestId = newRequestId()
  if (!session) {
    return errJson({ requestId, status: 401, code: "UNAUTHORIZED", message: "Unauthorized." })
  }

  const body = input.readBody === false ? null : await req.json().catch(() => null)
  const semanticHeaders: Record<string, string | null> = {}
  for (const h of input.idempotency.semanticHeaders ?? []) semanticHeaders[h] = req.headers.get(h)

  const query: Record<string, string> = {}
  const entries = Array.from(url.searchParams.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  for (const [k, v] of entries) query[k] = v

  const method = req.method.toUpperCase()
  const idemScope = { orgId: session.orgId, userId: session.user.id, method, path }

  let idempotencyKey: string | null = null
  let idemHash: string | null = null
  let beganIdem = false
  let rlHeaders: Headers | undefined

  try {
    if (input.idempotency.required) {
      idempotencyKey = requireUuidV4(req.headers.get("Idempotency-Key"), "IDEMPOTENCY_KEY_REQUIRED")
      idemHash = requestHash({ query, body, semanticHeaders })

      const scopeMismatch = await findScopeMismatch({
        orgId: session.orgId,
        userId: session.user.id,
        key: idempotencyKey,
        method,
        path,
      })
      if (scopeMismatch) {
        return errJson({
          requestId: scopeMismatch.requestId,
          status: 409,
          code: "IDEMPOTENCY_SCOPE_MISMATCH",
          message: "Idempotency-Key was already used for a different endpoint.",
          details: { method: scopeMismatch.method, path: scopeMismatch.path },
        })
      }

      const replay = await findReplay({ scope: idemScope, key: idempotencyKey, requestHash: idemHash })
      if (replay.kind === "HIT") {
        const headers = mergeHeaders(
          { "X-Request-Id": replay.requestId },
          { "content-type": "application/json; charset=utf-8" }
        )
        return new NextResponse(replay.bodyText, { status: replay.status, headers })
      }
      if (replay.kind === "HASH_MISMATCH" || replay.kind === "IN_PROGRESS") {
        return errJson({
          requestId: replay.requestId,
          status: 409,
          code: "IDEMPOTENCY_KEY_REUSED",
          message:
            replay.kind === "HASH_MISMATCH"
              ? "Idempotency-Key was already used with a different request payload."
              : "Idempotent request is still processing. Retry later.",
        })
      }

      try {
        await beginIdempotency({ scope: idemScope, key: idempotencyKey, requestHash: idemHash, requestId })
        beganIdem = true
      } catch (err) {
        // Concurrency edge case: if two identical idempotent requests race, the
        // second request may lose the unique insert. Treat it as a replay/in-progress.
        const e = err as { code?: string }
        if (e?.code !== "P2002") throw err
        const replay2 = await findReplay({ scope: idemScope, key: idempotencyKey, requestHash: idemHash })
        if (replay2.kind === "HIT") {
          const headers = mergeHeaders(
            { "X-Request-Id": replay2.requestId },
            { "content-type": "application/json; charset=utf-8" }
          )
          return new NextResponse(replay2.bodyText, { status: replay2.status, headers })
        }
        if (replay2.kind === "HASH_MISMATCH" || replay2.kind === "IN_PROGRESS") {
          return errJson({
            requestId: replay2.requestId,
            status: 409,
            code: "IDEMPOTENCY_KEY_REUSED",
            message:
              replay2.kind === "HASH_MISMATCH"
                ? "Idempotency-Key was already used with a different request payload."
                : "Idempotent request is still processing. Retry later.",
          })
        }
        // If we still can't see it, treat as busy to avoid issuing a second mutation.
        return errJson({
          requestId,
          status: 409,
          code: "IDEMPOTENCY_KEY_REUSED",
          message: "Idempotent request is still processing. Retry later.",
        })
      }
    }

    const rl = await consumeRateLimit({ orgId: session.orgId, userId: session.user.id, scope: input.rateLimitScope })
    rlHeaders = rateLimitHeaders(rl)

    const result = await handler({ requestId, url, path, session, body, rateLimitScope: input.rateLimitScope })
    const okBody = { ...result.body, ok: true, requestId }
    const headers = mergeHeaders(result.headers, rlHeaders, { "X-Request-Id": requestId })
    const res = jsonResponse({ status: result.status ?? 200, headers, body: okBody })

    if (beganIdem && idempotencyKey && idemHash) {
      await storeIdempotencyResponse({
        scope: idemScope,
        key: idempotencyKey,
        requestHash: idemHash,
        requestId,
        status: result.status ?? 200,
        body: okBody,
      })
    }
    return res
  } catch (err) {
    const errorRes = apiErrorToResponse(err, requestId, rlHeaders)
    if (beganIdem && idempotencyKey && idemHash) {
      const status = errorRes.status
      const bodyText = await errorRes.clone().text()
      await storeIdempotencyResponse({
        scope: idemScope,
        key: idempotencyKey,
        requestHash: idemHash,
        requestId,
        status,
        body: bodyText,
      })
    }
    return errorRes
  }
}

function apiErrorToResponse(err: unknown, requestId: string, extraHeaders?: HeadersInit) {
  if (err instanceof ApiError) {
    const derived = mergeHeaders(extraHeaders, headersFromApiError(err))
    return errJson({
      requestId,
      status: err.status,
      code: err.code,
      message: err.message,
      details: err.details,
      fields: err.fields,
      init: { headers: derived },
    })
  }
  const message = err instanceof Error ? err.message : "Internal error."
  return errJson({
    requestId,
    status: 500,
    code: "INTERNAL",
    message,
    init: { headers: extraHeaders },
  })
}

function headersFromApiError(err: ApiError) {
  if (err.code !== "RATE_LIMITED") return undefined
  const d = err.details as
    | { limit?: number; remaining?: number; resetEpochSec?: number; retryAfterSec?: number }
    | undefined
  if (!d?.limit || d.resetEpochSec == null) return undefined
  const h = new Headers()
  h.set("RateLimit-Limit", String(d.limit))
  h.set("RateLimit-Remaining", String(d.remaining ?? 0))
  h.set("RateLimit-Reset", String(d.resetEpochSec))
  if (d.retryAfterSec != null) h.set("Retry-After", String(d.retryAfterSec))
  return h
}
