"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"

type Props = {
  reviewId: string
  hasReply: boolean
  draftStatus: string | null
  draftText: string
  verifierSummary: string | null
}

export function ReviewDetailClient(props: Props) {
  const router = useRouter()
  const [text, setText] = React.useState(props.draftText)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setText(props.draftText)
  }, [props.draftText])

  async function call(path: string, body?: unknown) {
    setBusy(path)
    setError(null)
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!res.ok) throw new Error(await res.text())
      // Some endpoints enqueue a job and then run a small worker batch. If that job failed,
      // surface the specific error to the user.
      const ct = res.headers.get("content-type") ?? ""
      if (ct.includes("application/json")) {
        const json = (await res.json().catch(() => null)) as
          | { jobId?: string; worker?: { results?: Array<{ id: string; ok: boolean; error?: string }> } }
          | null
        const jobId = json?.jobId
        const results = json?.worker?.results ?? []
        const match = jobId ? results.find((r) => r.id === jobId) : undefined
        if (match && !match.ok) {
          setError(match.error ?? "Job failed.")
        }
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const canPublish = !props.hasReply && props.draftStatus === "READY"

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {!props.draftStatus ? (
          <Button
            onClick={() => call(`/api/reviews/${props.reviewId}/drafts/generate`)}
            disabled={busy !== null || props.hasReply}
          >
            {busy ? "Working..." : "Generate draft"}
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              onClick={() => call(`/api/reviews/${props.reviewId}/drafts/edit`, { text })}
              disabled={busy !== null || props.hasReply || !text.trim()}
            >
              {busy ? "Saving..." : "Save changes"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => call(`/api/reviews/${props.reviewId}/drafts/verify`)}
              disabled={busy !== null || props.hasReply}
            >
              {busy ? "Verifying..." : "Run verifier"}
            </Button>
          </>
        )}

        <Button
          onClick={() => call(`/api/reviews/${props.reviewId}/reply/post`)}
          disabled={busy !== null || !canPublish}
        >
          {busy ? "Publishing..." : "Approve & publish"}
        </Button>

        {props.draftStatus ? <Badge variant="secondary">Draft: {props.draftStatus}</Badge> : null}
        {props.hasReply ? <Badge variant="secondary">Already replied</Badge> : null}
      </div>

      {error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border p-3 text-sm">
          {error}
        </div>
      ) : null}

      {props.verifierSummary ? (
        <div className="border-border bg-muted/30 rounded-md border p-3 text-sm">
          <div className="font-medium">Verifier</div>
          <div className="text-muted-foreground mt-1 whitespace-pre-wrap text-xs">
            {props.verifierSummary}
          </div>
        </div>
      ) : null}

      {props.draftStatus ? (
        <div className="space-y-2">
          <div className="text-sm font-medium">Draft reply</div>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} />
          <div className="text-muted-foreground text-xs">
            Keep replies factual and based on the review text only.
          </div>
        </div>
      ) : null}
    </div>
  )
}
