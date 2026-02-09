"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Sparkles, Save, ShieldCheck, Send, Loader2 } from "lucide-react"
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
  const isBusy = busy !== null

  return (
    <div className="space-y-4">
      {error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : null}

      {props.draftStatus ? (
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="Draft reply..."
        />
      ) : null}

      {props.verifierSummary ? (
        <div className="rounded-md border border-border bg-muted/30 p-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">Verifier</p>
          <pre className="whitespace-pre-wrap text-xs text-muted-foreground">{props.verifierSummary}</pre>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {!props.draftStatus ? (
          <Button
            size="sm"
            onClick={() => call(`/api/reviews/${props.reviewId}/drafts/generate`)}
            disabled={isBusy || props.hasReply}
          >
            {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            Generate draft
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => call(`/api/reviews/${props.reviewId}/drafts/edit`, { text })}
              disabled={isBusy || props.hasReply || !text.trim()}
            >
              {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => call(`/api/reviews/${props.reviewId}/drafts/verify`)}
              disabled={isBusy || props.hasReply}
            >
              <ShieldCheck className="size-3.5" />
              Verify
            </Button>
          </>
        )}

        <Button
          size="sm"
          onClick={() => call(`/api/reviews/${props.reviewId}/reply/post`)}
          disabled={isBusy || !canPublish}
        >
          {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          Publish
        </Button>

        {props.draftStatus ? (
          <Badge variant={props.draftStatus === "READY" ? "default" : "secondary"} className="ml-auto">
            {props.draftStatus}
          </Badge>
        ) : null}
        {props.hasReply ? <Badge variant="secondary" className="ml-auto">Replied</Badge> : null}
      </div>
    </div>
  )
}
