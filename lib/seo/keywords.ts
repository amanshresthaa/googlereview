import { SEO_PROFILE_LIMITS } from "@/lib/policy"

function normalizeKeyword(raw: string) {
  const v = raw.trim().toLowerCase()
  if (!v) return null
  if (v.length > SEO_PROFILE_LIMITS.KEYWORD_MAX_LENGTH) return null
  return v
}

export function normalizeKeywordList(values: string[], max: number) {
  const set = new Set<string>()
  for (const value of values) {
    const normalized = normalizeKeyword(value)
    if (!normalized) continue
    set.add(normalized)
    if (set.size >= max) break
  }
  return [...set]
}

export function normalizeSeoProfile(input: {
  primaryKeywords: string[]
  secondaryKeywords: string[]
  geoTerms: string[]
}) {
  return {
    primaryKeywords: normalizeKeywordList(input.primaryKeywords, SEO_PROFILE_LIMITS.PRIMARY_MAX),
    secondaryKeywords: normalizeKeywordList(input.secondaryKeywords, SEO_PROFILE_LIMITS.SECONDARY_MAX),
    geoTerms: normalizeKeywordList(input.geoTerms, SEO_PROFILE_LIMITS.GEO_MAX),
  }
}
