import { env } from "@/lib/env"

export async function openAiChatJson(input: {
  model: string
  messages: Array<{ role: "system" | "user"; content: string }>
  temperature?: number
}) {
  const e = env()
  if (!e.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.")
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${e.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      temperature: input.temperature ?? 0.2,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI error ${res.status}: ${text}`)
  }

  const json = (await res.json()) as {
    choices: Array<{ message: { content: string } }>
  }
  const content = json.choices?.[0]?.message?.content ?? ""
  return { content }
}

