export type HighlightSpan = {
  start: number
  end: number
  label: string
}

export function extractMentionsAndHighlights(comment: string | null | undefined, keywords: string[]) {
  if (!comment) return { mentions: [] as string[], highlights: [] as HighlightSpan[] }

  const mentions = new Set<string>()
  const highlights: HighlightSpan[] = []

  for (const raw of keywords) {
    const k = raw.trim()
    if (!k) continue

    // Word-boundary when the keyword is a single word; substring match for phrases.
    const isPhrase = /\s/.test(k)
    const pattern = isPhrase ? escapeRegex(k) : `\\b${escapeRegex(k)}\\b`
    const re = new RegExp(pattern, "gi")

    for (const match of comment.matchAll(re)) {
      if (typeof match.index !== "number") continue
      const start = match.index
      const end = start + match[0]!.length
      mentions.add(k.toLowerCase())
      highlights.push({ start, end, label: k })
    }
  }

  highlights.sort((a, b) => a.start - b.start || a.end - b.end)
  return { mentions: Array.from(mentions).sort(), highlights }
}

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

