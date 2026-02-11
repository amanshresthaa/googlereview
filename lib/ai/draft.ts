import { z } from "zod"

export const evidenceSnapshotSchema = z.object({
  starRating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  reviewerDisplayName: z.string().nullable(),
  reviewerIsAnonymous: z.boolean(),
  locationDisplayName: z.string(),
  createTime: z.string(),
  highlights: z.array(
    z.object({
      start: z.number().int().min(0),
      end: z.number().int().min(0),
      label: z.string(),
    }),
  ),
  mentionKeywords: z.array(z.string()),
  seoProfile: z.object({
    primaryKeywords: z.array(z.string()),
    secondaryKeywords: z.array(z.string()),
    geoTerms: z.array(z.string()),
  }),
  tone: z.object({
    preset: z.string(),
    customInstructions: z.string().nullable(),
  }),
})

export type EvidenceSnapshot = z.infer<typeof evidenceSnapshotSchema>

export const verifierViolationSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  snippet: z.string().optional(),
})

export const llmVerifierResultSchema = z.object({
  pass: z.boolean(),
  violations: z.array(verifierViolationSchema),
  suggestedRewrite: z.union([z.string(), z.null()]).optional(),
})

export type LlmVerifierResult = {
  pass: boolean
  violations: Array<z.infer<typeof verifierViolationSchema>>
  suggestedRewrite?: string
}

export function normalizeLlmVerifierResult(
  input: z.infer<typeof llmVerifierResultSchema>,
): LlmVerifierResult {
  return {
    pass: input.pass,
    violations: input.violations,
    suggestedRewrite: input.suggestedRewrite ?? undefined,
  }
}

export function areDraftTextsEquivalent(previousDraftText: string, nextDraftText: string) {
  return normalizeDraftForComparison(previousDraftText) === normalizeDraftForComparison(nextDraftText)
}

function normalizeDraftForComparison(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}
