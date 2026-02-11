"use client"

import * as React from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { type ReviewDetail } from "@/lib/hooks"
import { withIdempotencyHeader } from "@/lib/api/client-idempotency"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  AlertTriangle,
  Copy,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
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

  React.useEffect(() => {
    setText(draft?.text ?? "")
  }, [draft?.id, draft?.text])

  const isDirty = text !== (draft?.text ?? "")
  const hasText = text.trim().length > 0
  const isReplied = Boolean(review.reply.comment)
  const isBlocked = draft?.status === "BLOCKED_BY_VERIFIER"
  const verifierJson = draft?.verifierResultJson as null | { issues?: string[] }
  const verifierIssue = verifierJson?.issues?.[0] ?? null
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length

  const apiCall = async (url: string, method: string, body?: unknown) => {
    const upper = method.toUpperCase()
    const mutating = upper === "POST" || upper === "PUT" || upper === "PATCH" || upper === "DELETE"
    const baseHeaders = body ? { "content-type": "application/json" } : undefined
    const headers = mutating ? withIdempotencyHeader(baseHeaders) : baseHeaders
    const res = await fetch(url, {
      method: upper,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    if (res.status === 401) {
      window.location.href = "/signin"
      return null
    }
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(data?.error ?? res.statusText)
    return data
  }

  const run = async (
    nextBusy: "generate" | "save" | "verify" | "publish",
    fn: () => Promise<void>,
    successMessage: string,
  ) => {
    setBusy(nextBusy)
    try {
      await fn()
      toast.success(successMessage)
      window.dispatchEvent(new CustomEvent("reviews:mutated", { detail: { reviewId } }))
      refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const copyText = () => {
    if (!hasText) return
    navigator.clipboard?.writeText(text).then(
      () => toast.success("Draft copied"),
      () => toast.error("Copy failed")
    )
  }

  const clearText = () => {
    setText("")
  }

  if (!draft && !isReplied) {
    return (
      <div className="rounded-2xl border border-dashed border-[#8ab4f8]/60 bg-gradient-to-b from-white to-[#f8faff] px-6 py-10 text-center dark:from-[#0b1524] dark:to-[#10213d]">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[#1a73e8]/10 text-[#1a73e8] dark:bg-[#8ab4f8]/15 dark:text-[#8ab4f8]">
          <Sparkles className="h-6 w-6" />
        </div>
        <p className="text-base font-semibold text-foreground">Generate AI draft reply</p>
        <p className="mx-auto mt-1.5 max-w-[220px] text-xs leading-relaxed text-[#5f6368] dark:text-[#9aa0a6]">
          Create a first response before editing and posting.
        </p>
        <Button
          type="button"
          onClick={() =>
            run("generate", () => apiCall(`/api/reviews/${reviewId}/drafts/generate`, "POST"), "Draft generated")
          }
          disabled={Boolean(busy)}
          className="mt-5 rounded-full bg-[#1a73e8] px-6 text-white shadow-md hover:bg-[#1765cc] dark:bg-[#8ab4f8] dark:text-[#202124]"
        >
          {busy === "generate" ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Generate Draft
        </Button>
      </div>
    )
  }

  if (isReplied) return null

  return (
    <div className="space-y-3">
      {/* Tone selector */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#174ea6] dark:text-[#d2e3fc]">
            Tone
          </span>
          {isDirty && (
            <Badge className="rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-[10px] font-semibold text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300">
              Unsaved
            </Badge>
          )}
        </div>
        <ToggleGroup
          type="single"
          value={tone}
          onValueChange={(value) => {
            if (value) setTone(value)
          }}
          className="rounded-full border border-[#dadce0] bg-white p-1 dark:border-[#3c4043] dark:bg-[#1f1f1f]"
        >
          {(["professional", "friendly", "apologetic"] as const).map((option) => (
            <ToggleGroupItem
              key={option}
              value={option}
              className={cn(
                "h-7 rounded-full px-3 text-[11px] font-medium capitalize",
                tone === option
                  ? "bg-[#1a73e8] text-white dark:bg-[#8ab4f8] dark:text-[#202124]"
                  : "text-[#5f6368] dark:text-[#9aa0a6]",
              )}
            >
              {option}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* Editor card */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border bg-white shadow-sm transition-colors dark:bg-[#1f1f1f]",
          isBlocked
            ? "border-red-300 ring-1 ring-red-200 dark:border-red-800 dark:ring-red-900"
            : "border-[#dadce0] focus-within:border-[#1a73e8] focus-within:ring-1 focus-within:ring-[#1a73e8]/30 dark:border-[#3c4043] dark:focus-within:border-[#8ab4f8] dark:focus-within:ring-[#8ab4f8]/30",
        )}
      >
        {/* Overlay placeholder when empty and not generating */}
        {!hasText && busy !== "generate" && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-5">
            <div className="flex flex-col items-center gap-2 text-center">
              <Sparkles className="h-6 w-6 text-[#1a73e8]/40 dark:text-[#8ab4f8]/40" />
              <span className="text-sm text-[#5f6368]/70 dark:text-[#9aa0a6]/70">
                Use AI to generate a perfect response
              </span>
            </div>
          </div>
        )}

        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder=""
          disabled={busy === "generate"}
          className="min-h-[180px] resize-none border-0 bg-transparent p-5 text-sm leading-relaxed text-[#202124] placeholder:text-transparent focus-visible:ring-0 dark:text-[#e8eaed]"
        />

        {/* Status indicator row */}
        <div className="flex items-center justify-between border-t border-[#dadce0]/60 px-4 py-1.5 text-[11px] dark:border-[#3c4043]/60">
          <div>
            {isBlocked ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-red-600 dark:text-red-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                {verifierIssue || "Verifier blocked this draft"}
              </span>
            ) : draft?.status === "READY" ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                Verified
              </span>
            ) : (
              <span className="text-[#5f6368] dark:text-[#9aa0a6]">Awaiting verification</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={copyText}
              disabled={!hasText}
              className="inline-flex items-center gap-1 text-[#5f6368] transition-colors hover:text-foreground disabled:opacity-40 dark:text-[#9aa0a6]"
            >
              <Copy className="h-3 w-3" />
              Copy
            </button>
            <span className="font-mono text-[#5f6368] dark:text-[#9aa0a6]">
              {wordCount} {wordCount === 1 ? "word" : "words"}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#f1f3f4] px-3 py-2.5 dark:bg-[#292a2d]">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() =>
              run(
                "generate",
                () => apiCall(`/api/reviews/${reviewId}/drafts/generate`, "POST"),
                draft ? "Draft regenerated" : "Draft generated",
              )
            }
            disabled={Boolean(busy)}
            className="h-8 rounded-full bg-[#1a73e8] px-4 text-xs font-semibold text-white shadow-none hover:bg-[#1765cc] dark:bg-[#8ab4f8] dark:text-[#202124]"
          >
            {busy === "generate" ? (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : draft?.text ? (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            {draft?.text ? "Regenerate" : "Generate AI Reply"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearText}
            disabled={!hasText || Boolean(busy)}
            className="h-8 w-8 rounded-full p-0 text-red-500 hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-950/30 dark:hover:text-red-300"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              run("verify", () => apiCall(`/api/reviews/${reviewId}/drafts/verify`, "POST"), "Draft verified")
            }
            disabled={!hasText || Boolean(busy)}
            className="h-8 rounded-full border-[#dadce0] bg-white text-xs dark:border-[#3c4043] dark:bg-[#1f1f1f]"
          >
            {busy === "verify" ? (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
            )}
            Verify
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              run("save", () => apiCall(`/api/reviews/${reviewId}/drafts/edit`, "POST", { text }), "Draft saved")
            }
            disabled={!isDirty || Boolean(busy) || !hasText}
            className="h-8 rounded-full border-[#dadce0] bg-white text-xs dark:border-[#3c4043] dark:bg-[#1f1f1f]"
          >
            {busy === "save" ? (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            Save Draft
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() =>
              run("publish", () => apiCall(`/api/reviews/${reviewId}/reply/post`, "POST"), "Reply posted successfully")
            }
            disabled={!hasText || Boolean(busy)}
            className="h-8 rounded-full bg-[#202124] px-4 text-xs font-semibold text-white shadow-none hover:bg-[#3c4043] dark:bg-[#e8eaed] dark:text-[#202124] dark:hover:bg-[#d2d4d7]"
          >
            {busy === "publish" ? (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-3.5 w-3.5" />
            )}
            Post Reply
          </Button>
        </div>
      </div>

      {/* Secure footer */}
      <p className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-widest text-[#5f6368]/60 dark:text-[#9aa0a6]/60">
        <ShieldCheck className="h-3 w-3" />
        Secure &amp; Official Google Business Response
      </p>
    </div>
  )
}
