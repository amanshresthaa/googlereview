import { z } from "zod"
import { env } from "@/lib/env"
import { openAiChatJson } from "@/lib/ai/openai"
import { geminiGenerateText } from "@/lib/ai/gemini"

export const evidenceSnapshotSchema = z.object({
  starRating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  reviewerDisplayName: z.string().nullable(),
  reviewerIsAnonymous: z.boolean(),
  locationDisplayName: z.string(),
  createTime: z.string(),
  highlights: z.array(z.object({ start: z.number().int().min(0), end: z.number().int().min(0), label: z.string() })),
  mentionKeywords: z.array(z.string()),
  tone: z.object({
    preset: z.string(),
    customInstructions: z.string().nullable(),
  }),
})

export type EvidenceSnapshot = z.infer<typeof evidenceSnapshotSchema>

const verifierSchema = z.object({
  pass: z.boolean(),
  violations: z.array(
    z.object({
      code: z.string(),
      message: z.string(),
      snippet: z.string().optional(),
    })
  ),
  // Some models occasionally emit `null` for optional fields. Accept it and normalize.
  suggestedRewrite: z.union([z.string(), z.null()]).optional(),
})

export async function generateDraftText(input: {
  provider: "OPENAI" | "GEMINI"
  evidence: EvidenceSnapshot
  signal?: AbortSignal
}) {
  const e = env()
  const prompt = buildDraftPrompt(input.evidence)

  if (input.provider === "OPENAI") {
    const model = e.OPENAI_MODEL_DRAFT ?? "gpt-4o-mini"
    const res = await openAiChatJson({
      model,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You write Google Business Profile review replies. Use ONLY the provided evidence. Never invent details. Be polite, short, and specific.",
        },
        { role: "user", content: prompt },
      ],
      signal: input.signal,
    })
    return res.content.trim()
  }

  const model = e.GEMINI_MODEL ?? "gemini-2.0-flash"
  const res = await geminiGenerateText({ model, prompt })
  return res.text.trim()
}

export async function verifyDraftWithLlm(input: {
  provider: "OPENAI" | "GEMINI"
  evidence: EvidenceSnapshot
  draftText: string
  signal?: AbortSignal
}) {
  const e = env()
  const prompt = buildVerifierPrompt(input.evidence, input.draftText)

  let raw = ""
  if (input.provider === "OPENAI") {
    const model = e.OPENAI_MODEL_VERIFY ?? "gpt-4o-mini"
    const res = await openAiChatJson({
      model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You are a strict verifier. You must output ONLY valid JSON. Do not include markdown.",
        },
        { role: "user", content: prompt },
      ],
      signal: input.signal,
    })
    raw = res.content.trim()
  } else {
    const model = e.GEMINI_MODEL ?? "gemini-2.0-flash"
    const res = await geminiGenerateText({ model, prompt })
    raw = res.text.trim()
  }

  const json = safeParseJson(raw)
  const parsed = verifierSchema.safeParse(json)
  if (!parsed.success) {
    throw new Error(`Verifier returned invalid JSON shape: ${parsed.error.message}`)
  }
  return {
    ...parsed.data,
    suggestedRewrite: parsed.data.suggestedRewrite ?? undefined,
  }
}

function buildDraftPrompt(evidence: EvidenceSnapshot) {
  return [
    "Evidence (JSON):",
    JSON.stringify(evidence),
    "",
    "Task:",
    "Write a reply that:",
    "1) Thanks the guest.",
    "2) Addresses what they said using ONLY evidence.comment and the star rating.",
    "3) If the review is negative (<=2 stars), apologize and invite them to contact the restaurant without claiming fixes were made.",
    "4) If the review is positive (5 stars), keep it friendly and concise.",
    "",
    "Output ONLY the reply text. No quotes, no JSON.",
  ].join("\n")
}

function buildVerifierPrompt(evidence: EvidenceSnapshot, draftText: string) {
  return [
    "Evidence (JSON):",
    JSON.stringify(evidence),
    "",
    "Draft reply:",
    draftText,
    "",
    "Rules:",
    "- The reply must not claim actions were taken unless the evidence.comment explicitly states it.",
    "- The reply must not invent menu items, timing, staff names, refunds, fixes, or other specifics not present in evidence.comment.",
    "- If evidence.comment is empty/null, reply must be generic and not assume specifics.",
    "",
    "Return ONLY JSON of shape:",
    `{"pass": boolean, "violations": [{"code": string, "message": string, "snippet"?: string}], "suggestedRewrite"?: string}`,
  ].join("\n")
}

function safeParseJson(raw: string) {
  // Strip common wrappers if the model ignores instructions.
  const trimmed = raw.trim()
  const first = trimmed.indexOf("{")
  const last = trimmed.lastIndexOf("}")
  if (first === -1 || last === -1 || last < first) {
    throw new Error("No JSON object found in verifier output.")
  }
  const sliced = trimmed.slice(first, last + 1)
  return JSON.parse(sliced) as unknown
}
