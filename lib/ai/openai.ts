import { env } from "@/lib/env"
import { RetryableJobError } from "@/lib/jobs/errors"

export async function openAiChatJson(input: {
  model: string
  messages: Array<{ role: "system" | "user"; content: string }>
  temperature?: number
  signal?: AbortSignal
}) {
  const e = env()
  if (!e.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.")
  }

  let res: Response
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
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
      signal: input.signal,
    })
  } catch (err) {
    const name = err instanceof Error ? err.name : ""
    if (name === "AbortError") {
      throw new RetryableJobError("UPSTREAM_TIMEOUT", "OpenAI request timed out.")
    }
    throw new RetryableJobError("UPSTREAM_TIMEOUT", "OpenAI request failed.")
  }

  if (!res.ok) {
    // Never include upstream response bodies (could contain PII).
    if (res.status === 408) {
      throw new RetryableJobError("UPSTREAM_TIMEOUT", "OpenAI timeout.", { status: res.status })
    }
    if (res.status === 429) {
      throw new RetryableJobError("UPSTREAM_RATE_LIMITED", "OpenAI rate limited.", { status: res.status })
    }
    if (res.status >= 500) {
      throw new RetryableJobError("UPSTREAM_5XX", "OpenAI server error.", { status: res.status })
    }
    throw new RetryableJobError("UPSTREAM_4XX", "OpenAI client error.", { status: res.status })
  }

  const json = (await res.json()) as {
    choices: Array<{ message: { content: string } }>
  }
  const content = json.choices?.[0]?.message?.content ?? ""
  return { content }
}
