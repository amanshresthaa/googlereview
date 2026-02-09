import { GoogleGenAI } from "@google/genai"
import { env } from "@/lib/env"

export async function geminiGenerateText(input: {
  model: string
  prompt: string
}) {
  const e = env()
  if (!e.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured.")

  const ai = new GoogleGenAI({ apiKey: e.GEMINI_API_KEY })
  const resp = await ai.models.generateContent({
    model: input.model,
    contents: [{ role: "user", parts: [{ text: input.prompt }] }],
  })

  // The SDK exposes a convenience `text` getter on response objects.
  const text = (resp as unknown as { text?: string }).text ?? ""
  return { text }
}

