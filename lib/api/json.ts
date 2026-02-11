import crypto from "node:crypto"

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function stableSortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableSortObject)
  if (!isPlainObject(value)) return value
  const keys = Object.keys(value).sort((a, b) => a.localeCompare(b))
  const out: Record<string, unknown> = {}
  for (const k of keys) out[k] = stableSortObject(value[k])
  return out
}

export function stableJsonStringify(value: unknown) {
  return JSON.stringify(stableSortObject(value))
}

export function byteLengthUtf8(s: string) {
  return Buffer.byteLength(s, "utf8")
}

export function newRequestId() {
  return crypto.randomUUID()
}

