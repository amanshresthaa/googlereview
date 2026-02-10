import { GoogleGenAI } from "@google/genai"
import { env } from "@/lib/env"
import { RetryableJobError } from "@/lib/jobs/errors"

export async function geminiGenerateText(input: {
  model: string
  prompt: string
}) {
  const e = env()
  if (!e.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured.")

  const ai = new GoogleGenAI({ apiKey: e.GEMINI_API_KEY })
  let resp: unknown
  try {
    resp = await ai.models.generateContent({
      model: input.model,
      contents: [{ role: "user", parts: [{ text: input.prompt }] }],
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes("429")) {
      throw new RetryableJobError("UPSTREAM_RATE_LIMITED", "Gemini rate limited.")
    }
    if (msg.toLowerCase().includes("timeout") || msg.toLowerCase().includes("timed out")) {
      throw new RetryableJobError("UPSTREAM_TIMEOUT", "Gemini request timed out.")
    }
    throw new RetryableJobError("UPSTREAM_5XX", "Gemini request failed.")
  }

  // The SDK exposes a convenience `text` getter on response objects.
  const text = (resp as unknown as { text?: string }).text ?? ""
  return { text }
}
