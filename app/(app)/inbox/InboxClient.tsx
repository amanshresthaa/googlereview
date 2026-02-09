"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { JobHealthWidget } from "@/components/JobHealthWidget"
import {
  Star,
  Send,
  Sparkles,
  Save,
  ShieldCheck,
  Loader2,
  ArrowLeft,
  X,
  Inbox as InboxIcon,
  AlertCircle,
  CheckSquare,
} from "lucide-react"

type ReviewRow = {
  id: string
  starRating: number
  snippet: string
  locationName: string
  createTimeIso: string
  unanswered: boolean
  draftStatus: string | null
  mentions: string[]
  reviewerName: string | null
}

type ReviewDetail = {
  id: string
  starRating: number
  comment: string | null
  createTime: string
  reviewer: { displayName: string | null; isAnonymous: boolean }
  reply: { comment: string | null; updateTime: string | null }
  location: { id: string; name: string }
  mentions: string[]
  currentDraft: {
    id: string
    status: string
    text: string
    verifierResultJson: unknown
  } | null
}

type Props = {
  filter: string
  mention: string | null
  mentionKeywords: string[]
  allowBulk: boolean
  rows: ReviewRow[]
}

function formatAge(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

function urgencyBorder(starRating: number) {
  if (starRating <= 2) return "border-l-red-500"
  if (starRating <= 4) return "border-l-amber-500"
  return "border-l-emerald-500"
}

function parseVerifierSummary(json: unknown): string | null {
  if (!json || typeof json !== "object") return null
  const obj = json as Record<string, unknown>
  if (typeof obj.summary === "string") return obj.summary
  if (typeof obj.result === "string") return obj.result
  try {
    return JSON.stringify(json, null, 2)
  } catch {
    return null
  }
}

export function InboxClient({ filter, mention, mentionKeywords, allowBulk, rows }: Props) {
  const router = useRouter()
  const sp = useSearchParams()
  const spKey = sp?.toString() ?? ""

  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [detail, setDetail] = React.useState<ReviewDetail | null>(null)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [draftText, setDraftText] = React.useState("")
  const [busy, setBusy] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [showDetail, setShowDetail] = React.useState(false)

  const [selected, setSelected] = React.useState(() => new Set<string>())
  const [bulkBusy, setBulkBusy] = React.useState(false)
  const [bulkError, setBulkError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setSelected(new Set())
    setSelectedId(null)
    setDetail(null)
    setShowDetail(false)
  }, [spKey])

  const fetchDetail = React.useCallback(async (id: string) => {
    setDetailLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/reviews/${id}`)
      if (!res.ok) throw new Error(await res.text())
      const data: ReviewDetail = await res.json()
      setDetail(data)
      setDraftText(data.currentDraft?.text ?? "")
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (selectedId) {
      fetchDetail(selectedId)
    }
  }, [selectedId, fetchDetail])

  function selectReview(id: string) {
    setSelectedId(id)
    setShowDetail(true)
    setError(null)
  }

  async function callAction(path: string, body?: unknown) {
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
          return
        }
      }
      if (path.endsWith("/reply/post")) {
        router.refresh()
      }
      if (selectedId) {
        await fetchDetail(selectedId)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  async function bulkApprove() {
    setBulkBusy(true)
    setBulkError(null)
    try {
      const res = await fetch("/api/replies/bulk-approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reviewIds: Array.from(selected) }),
      })
      if (!res.ok) throw new Error(await res.text())
      const ct = res.headers.get("content-type") ?? ""
      if (ct.includes("application/json")) {
        const json = (await res.json().catch(() => null)) as
          | {
              jobIds?: string[]
              worker?: { results?: Array<{ id: string; ok: boolean; error?: string }> }
            }
          | null
        const jobIds = new Set(json?.jobIds ?? [])
        const results = json?.worker?.results ?? []
        const failed = results.find((r) => jobIds.has(r.id) && !r.ok)
        if (failed) {
          throw new Error(failed.error ?? "Bulk post failed for at least one reply.")
        }
      }
      setSelected(new Set())
      router.refresh()
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : String(e))
    } finally {
      setBulkBusy(false)
    }
  }

  const filters: Array<{ key: string; label: string; href: string }> = [
    { key: "unanswered", label: "Unanswered", href: "/inbox?filter=unanswered" },
    { key: "urgent", label: "1–2★", href: "/inbox?filter=urgent" },
    { key: "five_star", label: "5★", href: "/inbox?filter=five_star" },
  ]

  const hasReply = !!detail?.reply?.comment
  const draftStatus = detail?.currentDraft?.status ?? null
  const canPublish = !hasReply && draftStatus === "READY"
  const verifierSummary = detail?.currentDraft?.verifierResultJson
    ? parseVerifierSummary(detail.currentDraft.verifierResultJson)
    : null

  const listPane = (
    <div
      className={`w-full md:w-[400px] md:min-w-[340px] md:max-w-[480px] border-r border-border flex flex-col overflow-hidden ${
        showDetail ? "hidden md:flex" : "flex"
      }`}
    >
      <div className="shrink-0 px-4 pt-4">
        <JobHealthWidget pollMs={15_000} />
      </div>
      <div className="flex items-center gap-4 overflow-x-auto border-b border-border px-4 shrink-0">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={f.href}
            className={`whitespace-nowrap py-3 text-sm font-medium border-b-2 transition-colors ${
              filter === f.key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </Link>
        ))}
        {mentionKeywords.length > 0 && (
          <>
            <Separator orientation="vertical" className="h-5" />
            {mentionKeywords.map((k) => (
              <Link
                key={k}
                href={`/inbox?filter=mentions&mention=${encodeURIComponent(k)}`}
                className={`whitespace-nowrap py-3 text-sm font-medium border-b-2 transition-colors ${
                  filter === "mentions" && mention === k
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {k}
              </Link>
            ))}
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <InboxIcon className="h-10 w-10 mb-3" />
            <p className="text-sm">No reviews found.</p>
          </div>
        ) : (
          rows.map((r) => {
            const isSelected = selectedId === r.id
            const canSelect =
              allowBulk && r.starRating === 5 && r.unanswered && r.draftStatus === "READY"
            const checked = selected.has(r.id)

            return (
              <div
                key={r.id}
                className={`flex items-start gap-3 border-l-2 border-b border-border/40 px-4 py-3 cursor-pointer transition-colors ${urgencyBorder(r.starRating)} ${
                  isSelected ? "bg-muted" : "hover:bg-muted/40"
                }`}
                onClick={() => selectReview(r.id)}
              >
                {allowBulk && (
                  <input
                    type="checkbox"
                    disabled={!canSelect}
                    checked={checked}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      setSelected((prev) => {
                        const next = new Set(prev)
                        if (e.target.checked) next.add(r.id)
                        else next.delete(r.id)
                        return next
                      })
                    }}
                    className="mt-1 accent-primary h-4 w-4 rounded shrink-0"
                  />
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                      ★ {r.starRating}
                    </span>
                    {r.draftStatus === "READY" && r.unanswered && (
                      <Badge className="border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400">
                        Draft ready
                      </Badge>
                    )}
                    {r.draftStatus === "BLOCKED_BY_VERIFIER" && (
                      <Badge variant="destructive">Blocked</Badge>
                    )}
                    {!r.unanswered && <Badge variant="outline">Answered</Badge>}
                  </div>
                  <p className="text-sm text-foreground line-clamp-2 leading-snug">
                    {r.snippet || "(Rating only)"}
                  </p>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                    <span>{r.locationName}</span>
                    <span>·</span>
                    <span>{formatAge(r.createTimeIso)}</span>
                    {r.mentions.length > 0 && (
                      <>
                        <span>·</span>
                        <span>{r.mentions.join(", ")}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {allowBulk && (
        <div className="shrink-0 border-t border-border bg-background px-4 py-3 flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelected(new Set(rows.filter((r) => r.starRating === 5 && r.unanswered && r.draftStatus === "READY").map((r) => r.id)))}
            disabled={bulkBusy}
          >
            <CheckSquare className="size-4" />
            Select all
          </Button>
          {selected.size > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelected(new Set())}
              disabled={bulkBusy}
            >
              <X className="size-4" />
              Clear
            </Button>
          )}
          <div className="flex-1" />
          <span className="text-xs text-muted-foreground">{selected.size} selected</span>
          <Button
            size="sm"
            onClick={bulkApprove}
            disabled={bulkBusy || selected.size === 0}
          >
            {bulkBusy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Approve & post
          </Button>
        </div>
      )}

      {bulkError && (
        <div className="shrink-0 border-t border-destructive/30 bg-destructive/10 text-destructive px-4 py-2 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {bulkError}
        </div>
      )}
    </div>
  )

  const detailPane = (
    <div
      className={`flex-1 flex flex-col overflow-hidden ${
        showDetail ? "flex" : "hidden md:flex"
      }`}
    >
      {!selectedId ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <InboxIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Select a review to view details</p>
          </div>
        </div>
      ) : detailLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !detail ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <p className="text-sm">Failed to load review.</p>
        </div>
      ) : (
        <>
          <div className="shrink-0 border-b border-border px-6 py-3 flex items-center gap-3 md:hidden">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setShowDetail(false)
                setSelectedId(null)
                setDetail(null)
              }}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <span className="text-sm font-medium">Back to list</span>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-0.5">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${
                      i < detail.starRating
                        ? "text-amber-500 fill-amber-500"
                        : "text-muted-foreground/30"
                    }`}
                  />
                ))}
              </span>
              <span className="text-sm font-medium">
                {detail.reviewer.isAnonymous
                  ? "Anonymous"
                  : detail.reviewer.displayName ?? "Unknown"}
              </span>
              <span className="text-xs text-muted-foreground">
                {detail.location.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatAge(detail.createTime)} ago
              </span>
              {hasReply && <Badge variant="secondary">Replied</Badge>}
              {detail.mentions.length > 0 &&
                detail.mentions.map((m) => (
                  <Badge key={m} variant="outline">
                    {m}
                  </Badge>
                ))}
            </div>

            <div className="rounded-lg bg-muted/40 p-4">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {detail.comment || "(Rating only — no comment)"}
              </p>
            </div>

            {hasReply && detail.reply.comment && (
              <div className="rounded-lg border border-border p-4 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Your reply</p>
                <p className="text-sm whitespace-pre-wrap">{detail.reply.comment}</p>
                {detail.reply.updateTime && (
                  <p className="text-xs text-muted-foreground">
                    {formatAge(detail.reply.updateTime)} ago
                  </p>
                )}
              </div>
            )}

            {error && (
              <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-2 rounded-md border p-3 text-sm">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Separator />

            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                {!draftStatus ? (
                  <Button
                    onClick={() => callAction(`/api/reviews/${detail.id}/drafts/generate`)}
                    disabled={busy !== null || hasReply}
                  >
                    {busy?.includes("/generate") ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    Generate draft
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        callAction(`/api/reviews/${detail.id}/drafts/edit`, { text: draftText })
                      }
                      disabled={busy !== null || hasReply || !draftText.trim()}
                    >
                      {busy?.includes("/edit") ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Save className="size-4" />
                      )}
                      Save changes
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => callAction(`/api/reviews/${detail.id}/drafts/verify`)}
                      disabled={busy !== null || hasReply}
                    >
                      {busy?.includes("/verify") ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="size-4" />
                      )}
                      Run verifier
                    </Button>
                  </>
                )}

                <Button
                  onClick={() => callAction(`/api/reviews/${detail.id}/reply/post`)}
                  disabled={busy !== null || !canPublish}
                >
                  {busy?.includes("/reply/post") ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  Approve & publish
                </Button>

                {draftStatus === "READY" && (
                  <Badge className="border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400">
                    READY
                  </Badge>
                )}
                {draftStatus === "BLOCKED_BY_VERIFIER" && (
                  <Badge variant="destructive">BLOCKED</Badge>
                )}
                {draftStatus && draftStatus !== "READY" && draftStatus !== "BLOCKED_BY_VERIFIER" && (
                  <Badge variant="secondary">{draftStatus}</Badge>
                )}
              </div>

              {verifierSummary && (
                <div className="flex items-start gap-3 rounded-md border border-border border-l-4 border-l-blue-500 p-4 text-sm">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-blue-500" />
                  <div>
                    <div className="font-medium">Verifier</div>
                    <div className="text-muted-foreground mt-1 whitespace-pre-wrap text-xs">
                      {verifierSummary}
                    </div>
                  </div>
                </div>
              )}

              {draftStatus && (
                <div className="space-y-2">
                  <Label htmlFor="draft-reply">Draft reply</Label>
                  <Textarea
                    id="draft-reply"
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    rows={8}
                    disabled={hasReply}
                  />
                  <p className="text-muted-foreground text-xs">
                    Keep replies factual and based on the review text only.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )

  return (
    <div className="flex h-full">
      {listPane}
      {detailPane}
    </div>
  )
}
