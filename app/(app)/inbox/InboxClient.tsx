"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type ReviewRow = {
  id: string
  starRating: number
  snippet: string
  locationName: string
  createTimeIso: string
  unanswered: boolean
  draftStatus: string | null
  mentions: string[]
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

export function InboxClient(props: { rows: ReviewRow[]; allowBulk: boolean }) {
  const router = useRouter()
  const sp = useSearchParams()
  const spKey = sp?.toString() ?? ""
  const [selected, setSelected] = React.useState(() => new Set<string>())
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setSelected(new Set())
  }, [spKey])

  async function bulkApprove() {
    setBusy(true)
    setError(null)
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
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {props.allowBulk ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={bulkApprove}
            disabled={busy || selected.size === 0}
          >
            Approve & post ({selected.size})
          </Button>
          <Button
            variant="secondary"
            onClick={() => setSelected(new Set(props.rows.map((r) => r.id)))}
            disabled={busy || props.rows.length === 0}
          >
            Select all
          </Button>
          <Button
            variant="ghost"
            onClick={() => setSelected(new Set())}
            disabled={busy || selected.size === 0}
          >
            Clear
          </Button>
        </div>
      ) : null}

      {error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border p-3 text-sm">
          {error}
        </div>
      ) : null}

      <div className="divide-border rounded-md border">
        {props.rows.length === 0 ? (
          <div className="text-muted-foreground p-4 text-sm">No reviews found.</div>
        ) : (
          props.rows.map((r) => {
            const canSelect =
              props.allowBulk &&
              r.starRating === 5 &&
              r.unanswered &&
              r.draftStatus === "READY"
            const checked = selected.has(r.id)
            return (
              <div key={r.id} className="hover:bg-muted/40 flex items-start gap-3 p-4">
                {props.allowBulk ? (
                  <input
                    type="checkbox"
                    disabled={!canSelect}
                    checked={checked}
                    onChange={(e) => {
                      setSelected((prev) => {
                        const next = new Set(prev)
                        if (e.target.checked) next.add(r.id)
                        else next.delete(r.id)
                        return next
                      })
                    }}
                    className="mt-1"
                  />
                ) : null}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/reviews/${r.id}`} className="text-sm font-medium hover:underline">
                      {"★".repeat(r.starRating)}
                      {"☆".repeat(Math.max(0, 5 - r.starRating))}{" "}
                      <span className="text-muted-foreground font-normal">
                        {r.snippet || "(Rating only)"}
                      </span>
                    </Link>
                    {!r.unanswered ? <Badge variant="secondary">Answered</Badge> : null}
                    {r.draftStatus === "READY" && r.unanswered ? (
                      <Badge>Draft ready</Badge>
                    ) : null}
                    {r.draftStatus === "BLOCKED_BY_VERIFIER" ? (
                      <Badge variant="secondary">Blocked</Badge>
                    ) : null}
                  </div>
                  <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span>{r.locationName}</span>
                    <span>·</span>
                    <span>{formatAge(r.createTimeIso)} ago</span>
                    {r.mentions.length ? (
                      <>
                        <span>·</span>
                        <span>Mentions: {r.mentions.join(", ")}</span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
