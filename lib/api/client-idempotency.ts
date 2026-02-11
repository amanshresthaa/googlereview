const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function bytesToUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

function randomBytes(): Uint8Array {
  const bytes = new Uint8Array(16)
  const cryptoApi = globalThis.crypto

  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes)
    return bytes
  }

  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256)
  }
  return bytes
}

function normalizeUuidV4(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes)
  // RFC 4122 version field
  out[6] = (out[6] & 0x0f) | 0x40
  // RFC 4122 variant field
  out[8] = (out[8] & 0x3f) | 0x80
  return out
}

export function createIdempotencyKey(): string {
  const candidate = globalThis.crypto?.randomUUID?.()
  if (candidate && UUID_V4_REGEX.test(candidate)) {
    return candidate
  }
  return bytesToUuid(normalizeUuidV4(randomBytes()))
}

export function withIdempotencyHeader(headers?: HeadersInit): Headers {
  const next = new Headers(headers)
  if (!next.has("Idempotency-Key")) {
    next.set("Idempotency-Key", createIdempotencyKey())
  }
  return next
}
