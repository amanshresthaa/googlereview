import crypto from "node:crypto"

function getKeyBytes(key: string) {
  // Accept base64 or hex to reduce setup friction; enforce 32 bytes.
  const base64 = safeDecodeBase64(key)
  if (base64?.length === 32) return base64
  const hex = safeDecodeHex(key)
  if (hex?.length === 32) return hex
  throw new Error(
    "TOKEN_ENCRYPTION_KEY must be 32 bytes (base64 or hex)."
  )
}

function safeDecodeBase64(value: string) {
  try {
    const buf = Buffer.from(value, "base64")
    // Heuristic: re-encode should be stable-ish. Not perfect, but catches obvious bad inputs.
    if (buf.length === 0) return null
    return buf
  } catch {
    return null
  }
}

function safeDecodeHex(value: string) {
  try {
    const buf = Buffer.from(value, "hex")
    if (buf.length === 0) return null
    return buf
  } catch {
    return null
  }
}

export function encryptString(plaintext: string, key: string) {
  const keyBytes = getKeyBytes(key)
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBytes, iv)
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(plaintext, "utf8")),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  // Format: base64(iv).base64(tag).base64(ciphertext)
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(".")
}

export function decryptString(enc: string, key: string) {
  const keyBytes = getKeyBytes(key)
  const parts = enc.split(".")
  if (parts.length !== 3) throw new Error("Invalid encrypted payload format.")

  const iv = Buffer.from(parts[0]!, "base64")
  const tag = Buffer.from(parts[1]!, "base64")
  const ciphertext = Buffer.from(parts[2]!, "base64")

  const decipher = crypto.createDecipheriv("aes-256-gcm", keyBytes, iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plaintext.toString("utf8")
}

export function sha256Hex(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex")
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url")
}

