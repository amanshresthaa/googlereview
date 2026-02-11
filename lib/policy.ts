export const DEFAULT_ORG_NAME = "My Restaurant"

export const DEFAULT_MENTION_KEYWORDS = [
  "cold",
  "wait",
  "rude",
  "dirty",
  "booking",
  "wrong order",
] as const

export const DEFAULT_AUTODRAFT_RATINGS = [1, 2, 3, 4, 5] as const

export const MAX_GOOGLE_REPLY_CHARS = 4096

export const ACTION_CLAIM_BLOCKLIST = [
  /we (have|had) fixed/i,
  /we fixed/i,
  /we['’]?ve fixed/i,
  /we (re)?trained/i,
  /we['’]?ve (re)?trained/i,
  /we refunded/i,
  /we['’]?ve refunded/i,
  /we investigated/i,
  /we['’]?ve investigated/i,
  /we reached out/i,
  /we['’]?ve reached out/i,
] as const
