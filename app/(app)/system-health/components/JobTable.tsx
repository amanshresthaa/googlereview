"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { MoreHorizontal } from "@/components/icons"

export type JobListItem = {
  id: string
  type: string
  status: string
  attempts: number
  maxAttempts: number
  runAtIso: string
  lockedAtIso: string | null
  completedAtIso: string | null
  createdAtIso: string
  dedupKey: string | null
  lastErrorCode: string | null
  lastError: string | null
}

function formatAgeMs(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d`
}

function safeDate(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return null
  return d
}

function isLockedStale(lockedAtIso: string | null, nowMs: number) {
  const d = safeDate(lockedAtIso)
  if (!d) return false
  // Worker stale-lock threshold is 15 minutes (server enforces the real rule).
  return nowMs - d.getTime() > 15 * 60_000
}

function canRunNow(job: JobListItem) {
  return (job.status === "PENDING" || job.status === "RETRYING") && !job.lockedAtIso
}

function canReschedule(job: JobListItem) {
  return (job.status === "PENDING" || job.status === "RETRYING") && !job.lockedAtIso
}

function canCancel(job: JobListItem, nowMs: number) {
  if ((job.status === "PENDING" || job.status === "RETRYING") && !job.lockedAtIso) return true
  if (job.status === "RUNNING" && isLockedStale(job.lockedAtIso, nowMs)) return true
  return false
}

function canForceUnlock(job: JobListItem, nowMs: number) {
  return job.status === "RUNNING" && isLockedStale(job.lockedAtIso, nowMs)
}

export function JobTable(props: {
  kind: "backlog" | "completed"
  jobs: JobListItem[]
  isOwner: boolean
  loading: boolean
  nowIso: string
  onViewDetails: (jobId: string) => void
  onAction: (jobId: string, action: { action: string; runAtIso?: string }) => void
}) {
  const [rescheduleOpen, setRescheduleOpen] = React.useState(false)
  const [rescheduleJob, setRescheduleJob] = React.useState<JobListItem | null>(null)
  const [rescheduleLocal, setRescheduleLocal] = React.useState<string>("")

  const openReschedule = (job: JobListItem) => {
    const runAt = safeDate(job.runAtIso)
    const local = runAt ? new Date(runAt.getTime() - runAt.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : ""
    setRescheduleJob(job)
    setRescheduleLocal(local)
    setRescheduleOpen(true)
  }

  const columns =
    props.kind === "backlog"
      ? ["Type", "Status", "Age", "RunAt", "LockedAt", "Attempts", "Error", ""]
      : ["Type", "Result", "CompletedAt", "Duration", "Attempts", "Error", ""]

  const nowMs = safeDate(props.nowIso)?.getTime() ?? 0

  return (
    <Card className="app-surface-shell overflow-hidden rounded-[24px] border-border/55 bg-card/90 p-0 shadow-sm">
      <div className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border/55 bg-muted/30 hover:bg-muted/35">
              {columns.map((c) => (
                <TableHead key={c} className="whitespace-nowrap py-3 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">{c}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.jobs.length ? (
              props.jobs.map((job) => {
                const createdAt = safeDate(job.createdAtIso)
                const completedAt = safeDate(job.completedAtIso)
                const lockedAt = safeDate(job.lockedAtIso)
                const runAt = safeDate(job.runAtIso)

                const age = createdAt ? formatAgeMs(nowMs - createdAt.getTime()) : "—"
                const duration =
                  lockedAt && completedAt ? formatAgeMs(completedAt.getTime() - lockedAt.getTime()) : "—"

                const errorLabel = job.lastErrorCode ?? job.lastError ?? null

                return (
                  <TableRow key={job.id} className="hover:bg-muted/10 border-border/50 transition-colors">
                    <TableCell className="whitespace-nowrap font-mono text-xs font-medium">{job.type}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant="secondary" className="rounded-lg bg-muted/55 px-2 py-0.5 text-[10px] font-black">{job.status}</Badge>
                    </TableCell>
                    {props.kind === "backlog" ? (
                      <>
                        <TableCell className="whitespace-nowrap tabular-nums text-sm font-semibold">{age}</TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{runAt ? runAt.toISOString() : "—"}</TableCell>
                        <TableCell className={cn("whitespace-nowrap font-mono text-xs", isLockedStale(job.lockedAtIso, nowMs) ? "text-destructive font-bold" : "text-muted-foreground")}>
                          {lockedAt ? lockedAt.toISOString() : "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums text-sm">
                          {job.attempts} / {job.maxAttempts}
                        </TableCell>
                        <TableCell className={cn("max-w-[240px] truncate text-xs", errorLabel && "text-destructive font-medium")}>
                          {errorLabel ?? "—"}
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                          {completedAt ? completedAt.toISOString() : "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums text-sm font-medium">{duration}</TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums text-sm">
                          {job.attempts} / {job.maxAttempts}
                        </TableCell>
                        <TableCell className={cn("max-w-[240px] truncate text-xs", errorLabel && job.status !== "COMPLETED" && "text-destructive font-medium")}>
                          {errorLabel ?? "—"}
                        </TableCell>
                      </>
                    )}
                    <TableCell className="whitespace-nowrap text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="app-action-secondary h-8 w-8 rounded-xl text-muted-foreground hover:bg-muted" disabled={props.loading}>
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl border-border/60 bg-card/95">
                          <DropdownMenuItem onClick={() => props.onViewDetails(job.id)}>View details</DropdownMenuItem>
                          <DropdownMenuSeparator />

                          {props.isOwner && props.kind === "backlog" ? (
                            <>
                              <DropdownMenuItem
                                disabled={!canRunNow(job)}
                                onClick={() => props.onAction(job.id, { action: "RUN_NOW" })}
                              >
                                Run now
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={!canReschedule(job)}
                                onClick={() => openReschedule(job)}
                              >
                                Reschedule…
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={!canCancel(job, nowMs)}
                                onClick={() => {
                                  const ok = window.confirm("Cancel this job? This prevents future execution.")
                                  if (!ok) return
                                  props.onAction(job.id, { action: "CANCEL" })
                                }}
                                className="text-destructive focus:text-destructive"
                              >
                                Cancel
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={!canForceUnlock(job, nowMs)}
                                onClick={() => {
                                  const ok = window.confirm("Force-unlock stale RUNNING job? This will retry it.")
                                  if (!ok) return
                                  props.onAction(job.id, { action: "FORCE_UNLOCK" })
                                }}
                                className="text-destructive focus:text-destructive"
                              >
                                Force unlock
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          ) : null}

                          {props.isOwner ? (
                            <DropdownMenuItem
                              onClick={() => props.onAction(job.id, { action: "REQUEUE" })}
                            >
                              Requeue
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem disabled>Requeue (Owner only)</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-12 text-center text-sm text-muted-foreground">
                  No jobs found matching your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
          <DialogContent className="rounded-2xl border-border/60 bg-card/95">
          <DialogHeader>
            <DialogTitle>Reschedule Job</DialogTitle>
            <DialogDescription className="text-xs">
              Only unlocked PENDING/RETRYING jobs can be rescheduled. Server enforces eligibility.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <div className="text-xs font-semibold">Run at (local time)</div>
            <Input
              type="datetime-local"
              value={rescheduleLocal}
              onChange={(e) => setRescheduleLocal(e.target.value)}
              className="rounded-xl border-border/55"
            />
            {rescheduleJob ? (
              <div className="text-[11px] text-muted-foreground font-mono">
                {rescheduleJob.id}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="secondary" className="app-action-secondary rounded-xl" onClick={() => setRescheduleOpen(false)}>
              Cancel
            </Button>
            <Button
              className="app-action-primary rounded-xl"
              onClick={() => {
                if (!rescheduleJob) return
                if (!rescheduleLocal) return
                const d = new Date(rescheduleLocal)
                props.onAction(rescheduleJob.id, { action: "RESCHEDULE", runAtIso: d.toISOString() })
                setRescheduleOpen(false)
              }}
            >
              Reschedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
