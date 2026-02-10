import { describe, expect, it } from "vitest"

import { createIdempotencyKey, withIdempotencyHeader } from "@/lib/api/client-idempotency"

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe("client idempotency helpers", () => {
  it("creates UUIDv4 idempotency keys", () => {
    const key = createIdempotencyKey()
    expect(UUID_V4_REGEX.test(key)).toBe(true)
  })

  it("adds idempotency key and preserves provided headers", () => {
    const headers = withIdempotencyHeader({ "content-type": "application/json" })
    const key = headers.get("Idempotency-Key")

    expect(headers.get("content-type")).toBe("application/json")
    expect(typeof key).toBe("string")
    expect(UUID_V4_REGEX.test(key ?? "")).toBe(true)
  })

  it("does not override an explicit idempotency key", () => {
    const explicit = "57f91f7e-bc1d-4ca9-a0b7-650f5f8f4a1f"
    const headers = withIdempotencyHeader({
      "Idempotency-Key": explicit,
      "content-type": "application/json",
    })

    expect(headers.get("Idempotency-Key")).toBe(explicit)
  })
})
