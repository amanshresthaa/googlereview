import { prisma } from "@/lib/db"
import { ApiError } from "@/lib/api/errors"
import { IDEMPOTENCY_MAX_RESPONSE_BYTES, IDEMPOTENCY_RETENTION_MS } from "@/lib/api/limits"
import { byteLengthUtf8, stableJsonStringify } from "@/lib/api/json"
import { sha256Hex } from "@/lib/crypto"

export type IdempotencyScope = {
  orgId: string
  userId: string
  method: string
  path: string
}

export function requestHash(input: {
  query: Record<string, string>
  body: unknown
  semanticHeaders: Record<string, string | null>
}) {
  // Canonicalize into a stable string then hash.
  const json = stableJsonStringify({
    query: input.query,
    body: input.body,
    semanticHeaders: input.semanticHeaders,
  })
  return sha256Hex(json)
}

export async function findReplay(input: {
  scope: IdempotencyScope
  key: string
  requestHash: string
}) {
  const row = await prisma.apiIdempotencyKey.findUnique({
    where: {
      orgId_userId_method_path_key: {
        orgId: input.scope.orgId,
        userId: input.scope.userId,
        method: input.scope.method,
        path: input.scope.path,
        key: input.key,
      },
    },
  })

  if (!row) return { kind: "MISS" as const }

  if (row.requestHash !== input.requestHash) {
    return { kind: "HASH_MISMATCH" as const, requestId: row.requestId }
  }

  if (row.responseStatus == null || !row.responseBodyText) {
    return { kind: "IN_PROGRESS" as const, requestId: row.requestId }
  }

  return {
    kind: "HIT" as const,
    requestId: row.requestId,
    status: row.responseStatus,
    bodyText: row.responseBodyText,
  }
}

export async function findScopeMismatch(input: {
  orgId: string
  userId: string
  key: string
  method: string
  path: string
}) {
  const row = await prisma.apiIdempotencyKey.findFirst({
    where: {
      key: input.key,
      NOT: {
        orgId: input.orgId,
        userId: input.userId,
        method: input.method,
        path: input.path,
      },
    },
    select: { requestId: true, method: true, path: true },
  })
  return row
}

export async function beginIdempotency(input: {
  scope: IdempotencyScope
  key: string
  requestHash: string
  requestId: string
}) {
  const expiresAt = new Date(Date.now() + IDEMPOTENCY_RETENTION_MS)
  try {
    await prisma.apiIdempotencyKey.create({
      data: {
        orgId: input.scope.orgId,
        userId: input.scope.userId,
        method: input.scope.method,
        path: input.scope.path,
        key: input.key,
        requestHash: input.requestHash,
        requestId: input.requestId,
        expiresAt,
      },
    })
  } catch (err) {
    // If concurrent, the caller should have attempted replay lookup first.
    throw err
  }
}

export async function storeIdempotencyResponse(input: {
  scope: IdempotencyScope
  key: string
  requestHash: string
  requestId: string
  status: number
  body: unknown
}) {
  const bodyText = typeof input.body === "string" ? input.body : stableJsonStringify(input.body)
  if (byteLengthUtf8(bodyText) > IDEMPOTENCY_MAX_RESPONSE_BYTES) {
    throw new ApiError({
      status: 500,
      code: "IDEMPOTENCY_STORAGE_FAILED",
      message: "Response too large to store for idempotency replay.",
    })
  }

  await prisma.apiIdempotencyKey.update({
    where: {
      orgId_userId_method_path_key: {
        orgId: input.scope.orgId,
        userId: input.scope.userId,
        method: input.scope.method,
        path: input.scope.path,
        key: input.key,
      },
    },
    data: {
      // Never overwrite requestHash/requestId: requestId must be replayed verbatim.
      requestHash: input.requestHash,
      responseStatus: input.status,
      responseBodyText: bodyText,
    },
  })
}

export function idempotencyMismatchError(kind: "HASH_MISMATCH" | "IN_PROGRESS", requestId: string) {
  if (kind === "HASH_MISMATCH") {
    return new ApiError({
      status: 409,
      code: "IDEMPOTENCY_KEY_REUSED",
      message: "Idempotency-Key was already used with a different request payload.",
      details: { requestId },
    })
  }
  return new ApiError({
    status: 409,
    code: "IDEMPOTENCY_KEY_REUSED",
    message: "Idempotent request is still processing. Retry later.",
    details: { requestId },
  })
}
