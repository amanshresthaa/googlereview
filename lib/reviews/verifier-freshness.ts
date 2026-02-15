import crypto from "node:crypto"
import { evidenceSnapshotSchema, type EvidenceSnapshot } from "@/lib/ai/draft"
import { extractMentionsAndHighlights } from "@/lib/reviews/mentions"

const VERIFIER_FRESHNESS_HASH_VERSION = 1 as const

type VerifierEvidenceInput = {
  review: {
    starRating: number
    comment: string | null
    reviewerDisplayName: string | null
    reviewerIsAnonymous: boolean
    createTime: Date
  }
  location: {
    displayName: string
    seoPrimaryKeywords: string[]
    seoSecondaryKeywords: string[]
    seoGeoTerms: string[]
  }
  settings: {
    mentionKeywords?: string[] | null
    tonePreset?: string | null
    toneCustomInstructions?: string | null
  }
}

export function buildVerifierEvidenceContext(input: VerifierEvidenceInput): {
  evidence: EvidenceSnapshot
  mentions: string[]
} {
  const mentionKeywords = input.settings.mentionKeywords ?? []
  const { mentions, highlights } = extractMentionsAndHighlights(input.review.comment, mentionKeywords)

  const evidence = evidenceSnapshotSchema.parse({
    starRating: input.review.starRating,
    comment: input.review.comment ?? null,
    reviewerDisplayName: input.review.reviewerDisplayName ?? null,
    reviewerIsAnonymous: input.review.reviewerIsAnonymous,
    locationDisplayName: input.location.displayName,
    createTime: input.review.createTime.toISOString(),
    highlights,
    mentionKeywords,
    seoProfile: {
      primaryKeywords: input.location.seoPrimaryKeywords,
      secondaryKeywords: input.location.seoSecondaryKeywords,
      geoTerms: input.location.seoGeoTerms,
    },
    tone: {
      preset: input.settings.tonePreset ?? "friendly",
      customInstructions: input.settings.toneCustomInstructions ?? null,
    },
  })

  return { evidence, mentions }
}

export function computeVerifierFreshnessHash(input: {
  evidence: EvidenceSnapshot
  draftText: string
}): string {
  const payload = {
    schemaVersion: VERIFIER_FRESHNESS_HASH_VERSION,
    evidence: input.evidence,
    draftText: input.draftText.trim(),
  }
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")
}
