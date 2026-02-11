"use client"

import * as React from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  type ReviewDetail,
} from "@/lib/hooks"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { withIdempotencyHeader } from "@/lib/api/client-idempotency"
import {
  Sparkles,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Save,
  Copy,
  ArrowUpRight,
} from "@/components/icons"

type Props = {
  reviewId: string
  review: ReviewDetail
  refresh: () => void
}

export function DraftEditor({ reviewId, review, refresh }: Props) {
  const draft = review.currentDraft
  const [text, setText] = React.useState(draft?.text ?? "")
  const [busy, setBusy] = React.useState<false | "generate" | "save" | "verify" | "publish">(false)
  const [tone, setTone] = React.useState("professional")
  const isRegenTarget = React.useRef(false)

  React.useEffect(() => {
    setText(draft?.text ?? "")
  }, [draft?.id, draft?.text])

  const isDirty = text !== (draft?.text ?? "")
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length
  const hasText = text.trim().length > 0
  const isReplied = Boolean(review.reply.comment)
  const isBlocked = draft?.status === "BLOCKED_BY_VERIFIER"

  // Parse verifier results
  const verifierJson = draft?.verifierResultJson as null | { pass?: boolean; issues?: string[] }
  const verifierIssues = verifierJson?.issues ?? []

  const apiCall = async (url: string, method: string, body?: unknown) => {
    const normalizedMethod = method.toUpperCase()
    const requiresIdempotency =
      normalizedMethod === "POST" ||
      normalizedMethod === "PUT" ||
      normalizedMethod === "PATCH" ||
      normalizedMethod === "DELETE"
    const baseHeaders = body ? { "content-type": "application/json" } : undefined
    const headers = requiresIdempotency ? withIdempotencyHeader(baseHeaders) : baseHeaders
    const res = await fetch(url, {
      method: normalizedMethod,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    if (res.status === 401) { window.location.href = "/signin"; return null }
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(data?.error ?? res.statusText)
    return data
  }

  const generate = async () => {
    setBusy("generate")
    isRegenTarget.current = true
    try {
      await apiCall(`/api/reviews/${reviewId}/drafts/generate`, "POST")
      toast.success("Draft generated")
      refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }

  const save = async () => {
    if (!hasText) return
    setBusy("save")
    try {
      await apiCall(`/api/reviews/${reviewId}/drafts/edit`, "POST", { text })
      toast.success("Draft saved")
      refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }

  const verify = async () => {
    setBusy("verify")
    try {
      await apiCall(`/api/reviews/${reviewId}/drafts/verify`, "POST")
      toast.success("Verification complete")
      refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }

  const publish = async () => {
    setBusy("publish")
    try {
      await apiCall(`/api/reviews/${reviewId}/reply/post`, "POST")
      toast.success("Reply published!")
      refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }

  const copyText = () => {
    if (!hasText) return
    navigator.clipboard?.writeText(text).then(
      () => toast.success("Copied"),
      () => toast.error("Copy failed")
    )
  }

  // Empty state — no draft yet
  if (!draft && !isReplied) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">AI Draft</span>
        </div>

        <Button
          type="button"
          onClick={generate}
          disabled={Boolean(busy)}
          className="w-full rounded-3xl border-2 border-dashed border-border bg-card hover:border-primary/40 hover:bg-primary/10 transition-all p-10 flex flex-col items-center gap-4 group"
        >
          {busy === "generate" ? (
            <RefreshCw className="h-8 w-8 text-primary animate-spin" />
          ) : (
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors border border-primary/20">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
          )}
          <div className="text-center">
            <div className="text-sm font-bold text-foreground">Generate AI Draft</div>
            <div className="text-xs text-muted-foreground mt-1">Create a smart reply powered by AI</div>
          </div>
        </Button>
      </div>
    )
  }

  // Already replied — read-only
  if (isReplied) return null

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">AI Draft</span>
          {isDirty && (
            <Badge variant="secondary" className="rounded-md text-[9px] h-5 px-2 bg-amber-100 text-amber-700 border-amber-200">
              Unsaved
            </Badge>
          )}
        </div>

        {/* Tone Picker */}
        <ToggleGroup
          type="single"
          value={tone}
          onValueChange={(value) => {
            if (value) setTone(value)
          }}
          className="flex bg-muted p-1 rounded-xl border border-border"
        >
          {["professional", "friendly", "concise"].map((t) => (
            <ToggleGroupItem
              key={t}
              value={t}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-all capitalize",
                tone === t ? "bg-card shadow-sm text-foreground ring-1 ring-border" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* Editor */}
      <div className={cn(
        "relative rounded-3xl border transition-all overflow-hidden bg-card group focus-within:ring-4 focus-within:ring-ring/30 shadow-card",
        isBlocked ? "border-orange-200 shadow-orange-50" : "border-border"
      )}>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Draft your reply..."
          className={cn(
            "min-h-[240px] text-base p-8 resize-none border-0 focus-visible:ring-0 leading-relaxed text-foreground placeholder:text-muted-foreground",
            busy === "generate" && "opacity-50 blur-[1px] transition-all"
          )}
        />

        {busy === "generate" && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <RefreshCw className="h-8 w-8 text-primary animate-spin" />
          </div>
        )}

        {/* Editor Footer */}
        <div className="bg-muted/60 backdrop-blur-md p-4 border-t border-border flex items-center justify-between">
          {isBlocked && verifierIssues.length > 0 ? (
            <div className="flex items-center gap-2 text-orange-700 text-xs font-medium bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100 max-w-[70%]">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="truncate">{verifierIssues[0]}</span>
            </div>
          ) : draft?.status === "READY" ? (
            <div className="flex items-center gap-2 text-emerald-700 text-xs font-medium bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
              <ShieldCheck className="h-4 w-4" />
              Verified facts against profile
            </div>
          ) : (
            <div className="text-xs text-muted-foreground font-medium">
              Ready to verify
            </div>
          )}
          <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
            <span>{wordCount} words</span>
            <span>{text.length} chars</span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={copyText}
            disabled={!hasText}
            className="text-muted-foreground hover:text-foreground rounded-xl h-9 text-xs"
          >
            <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={generate}
            disabled={Boolean(busy)}
            className="text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl h-9 text-xs"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", busy === "generate" && "animate-spin")} /> Regenerate
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={save}
            disabled={!isDirty || Boolean(busy)}
            className="rounded-xl border-border text-muted-foreground h-9 text-xs min-w-[80px]"
          >
            {busy === "save" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <><Save className="h-3.5 w-3.5 mr-1.5" /> Save</>}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={verify}
            disabled={!hasText || Boolean(busy)}
            className="rounded-xl border-border text-muted-foreground h-9 text-xs min-w-[80px]"
          >
            {busy === "verify" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <><ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> Verify</>}
          </Button>
          <Button
            size="sm"
            onClick={publish}
            disabled={!hasText || Boolean(busy)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-elevated font-medium h-9 text-xs min-w-[140px]"
          >
            {busy === "publish" ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>Approve & Reply <ArrowUpRight className="h-3.5 w-3.5 ml-1.5" /></>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
