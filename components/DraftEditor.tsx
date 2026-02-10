"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Sparkles,
  Save,
  ShieldCheck,
  Send,
  Loader2,
  AlertTriangle,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip"
import type { ReviewDetail } from "@/lib/hooks"

type Props = {
  reviewId: string
  draft: ReviewDetail["currentDraft"]
  hasReply: boolean
  replyComment: string | null
  replyUpdateTime: string | null
  onRefresh: () => void
}

export function DraftEditor({
  reviewId,
  draft,
  hasReply,
  replyComment,
  replyUpdateTime,
  onRefresh,
}: Props) {
  const router = useRouter()
  const [text, setText] = React.useState(draft?.text ?? "")
  const [busy, setBusy] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setText(draft?.text ?? "")
  }, [draft?.text])

  async function call(path: string, body?: unknown) {
    setBusy(path)
    setError(null)
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })

      if (res.status === 401) {
        router.push("/signin")
        return
      }
      if (res.status === 404) {
        setError("Review not found")
        return
      }
      if (res.status === 409) {
        setError("This review already has a published reply on Google.")
        return
      }

      if (!res.ok) throw new Error(await res.text())

      const ct = res.headers.get("content-type") ?? ""
      if (ct.includes("application/json")) {
        const json = await res.json().catch(() => null)
        if (json?.worker?.results) {
          const failed = json.worker.results.find(
            (r: { ok: boolean; error?: string }) => !r.ok,
          )
          if (failed) throw new Error(failed.error)
        }
      }
      onRefresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const isBusy = busy !== null

  if (hasReply) {
    return (
      <Card className="border-green-200 bg-green-50/50">
        <CardContent>
          <div className="flex items-center gap-2 mb-2">
            <Check size={16} className="text-green-600" />
            <span className="text-sm font-semibold text-green-800">
              Published Reply
            </span>
          </div>
          <p className="text-sm text-green-900 leading-relaxed whitespace-pre-wrap">
            {replyComment}
          </p>
          {replyUpdateTime && (
            <p className="text-xs text-green-600 mt-2">
              Published {new Date(replyUpdateTime).toLocaleDateString()}
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  if (!draft) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <p className="text-sm text-stone-500">No draft yet for this review.</p>
        <Button
          onClick={() => call(`/api/reviews/${reviewId}/drafts/generate`)}
          disabled={isBusy}
          className="bg-green-700 hover:bg-green-800 text-white"
        >
          {busy?.includes("generate") ? (
            <Loader2 className="animate-spin size-4 mr-2" />
          ) : (
            <Sparkles size={16} className="mr-2" />
          )}
          Generate Draft
        </Button>
        {error && (
          <p className="text-xs text-red-600 flex items-center gap-1">
            <AlertTriangle size={12} /> {error}
          </p>
        )}
      </div>
    )
  }

  const canPublish = draft.status === "READY"

  const publishDisabledReason = !canPublish
    ? "Run the verifier first to enable publishing"
    : null

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2 text-red-700 text-sm items-center">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      <Textarea
        className="w-full min-h-[180px] p-4 bg-stone-50 rounded-lg border-stone-200 text-stone-800 leading-relaxed resize-none"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Draft response..."
      />

      <div className="flex flex-wrap gap-2 justify-end">
        <Button
          variant="outline"
          onClick={() =>
            call(`/api/reviews/${reviewId}/drafts/edit`, { text })
          }
          disabled={isBusy || text === draft.text}
          className="border-stone-300"
        >
          {busy?.includes("edit") ? (
            <Loader2 className="animate-spin size-4 mr-2" />
          ) : (
            <Save size={14} className="mr-1.5" />
          )}
          Save Changes
        </Button>

        <Button
          variant="outline"
          onClick={() => call(`/api/reviews/${reviewId}/drafts/verify`)}
          disabled={isBusy}
          className="border-stone-300"
        >
          {busy?.includes("verify") ? (
            <Loader2 className="animate-spin size-4 mr-2" />
          ) : (
            <ShieldCheck size={14} className="mr-1.5" />
          )}
          Run Verifier
        </Button>

        <Button
          variant="outline"
          onClick={() => call(`/api/reviews/${reviewId}/drafts/generate`)}
          disabled={isBusy}
          className="border-stone-300"
        >
          {busy?.includes("generate") ? (
            <Loader2 className="animate-spin size-4 mr-2" />
          ) : (
            <Sparkles size={14} className="mr-1.5" />
          )}
          Regenerate
        </Button>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  onClick={() => call(`/api/reviews/${reviewId}/reply/post`)}
                  disabled={isBusy || !canPublish}
                  className="bg-green-700 hover:bg-green-800 text-white"
                >
                  {busy?.includes("reply/post") ? (
                    <Loader2 className="animate-spin size-4 mr-2" />
                  ) : (
                    <Send size={14} className="mr-1.5" />
                  )}
                  Approve &amp; Publish
                </Button>
              }
            />
            {publishDisabledReason && (
              <TooltipContent>{publishDisabledReason}</TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  )
}
