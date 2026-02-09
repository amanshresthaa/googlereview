import { HighlightSpan } from "@/lib/reviews/mentions"

export function HighlightedText(props: { text: string; spans: HighlightSpan[] }) {
  const spans = normalize(props.spans)
  if (!spans.length) return <p className="whitespace-pre-wrap text-sm">{props.text}</p>

  const out: Array<{ key: string; text: string; highlight: boolean }> = []
  let cursor = 0
  let i = 0
  for (const s of spans) {
    if (s.start > cursor) {
      out.push({ key: `t-${i++}`, text: props.text.slice(cursor, s.start), highlight: false })
    }
    out.push({ key: `h-${i++}`, text: props.text.slice(s.start, s.end), highlight: true })
    cursor = s.end
  }
  if (cursor < props.text.length) {
    out.push({ key: `t-${i++}`, text: props.text.slice(cursor), highlight: false })
  }

  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed">
      {out.map((p) =>
        p.highlight ? (
          <mark
            key={p.key}
            className="bg-amber-200/60 text-foreground rounded px-0.5 py-0.5"
          >
            {p.text}
          </mark>
        ) : (
          <span key={p.key}>{p.text}</span>
        )
      )}
    </p>
  )
}

function normalize(spans: HighlightSpan[]) {
  const sorted = [...spans].sort((a, b) => a.start - b.start || a.end - b.end)
  const out: HighlightSpan[] = []
  let lastEnd = -1
  for (const s of sorted) {
    if (s.start < 0 || s.end <= s.start) continue
    if (s.start < lastEnd) continue
    out.push(s)
    lastEnd = s.end
  }
  return out
}

