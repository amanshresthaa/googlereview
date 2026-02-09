import { describe, expect, it } from "vitest"
import { decryptString, encryptString, sha256Hex } from "@/lib/crypto"

describe("crypto helpers", () => {
  it("encrypt/decrypt roundtrip", () => {
    const key = Buffer.alloc(32, 7).toString("base64")
    const plaintext = "hello world"
    const enc = encryptString(plaintext, key)
    expect(enc).toContain(".")
    const dec = decryptString(enc, key)
    expect(dec).toBe(plaintext)
  })

  it("sha256Hex is deterministic", () => {
    expect(sha256Hex("a")).toBe(sha256Hex("a"))
    expect(sha256Hex("a")).not.toBe(sha256Hex("b"))
  })
})

