"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { formatAge, type ReviewRow } from "@/lib/hooks"
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  Globe,
  MapPin,
  MoreHorizontal,
  RefreshCw,
  Send,
  Sparkles,
  Star,
  X,
  Zap,
} from "@/components/icons"

function Stars({ rating, size = "default" }: { rating: number; size?: "sm" | "default" }) {
  const sizeClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={`star-${rating}-${String(i)}`}
          className={cn(sizeClass, i < rating ? "fill-yellow-400 text-yellow-400" : "text-zinc-200")}
        />
      ))}
    </div>
  )
}

export function ReviewItem({
  review,
  isSelected,
  onToggle,
  onGenerate,
  onSave,
  onPublish,
}: {
  review: ReviewRow
  isSelected: boolean
  onToggle: () => void
  onGenerate: (reviewId: string) => Promise<void>
  onSave: (reviewId: string, text: string) => Promise<void>
  onPublish: (reviewId: string, text: string, row: ReviewRow) => Promise<void>
}) {
  const [isEditing, setIsEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(review.currentDraft?.text ?? "")
  const [busy, setBusy] = React.useState<"generate" | "save" | "publish" | null>(null)

  React.useEffect(() => {
    setDraft(review.currentDraft?.text ?? "")
    setIsEditing(false)
  }, [review.id, review.currentDraft?.id, review.currentDraft?.text])

  const statusClass =
    review.status === "pending"
      ? "bg-yellow-50 text-yellow-700 border-yellow-200"
      : "bg-green-50 text-green-700 border-green-200"

  const run = async (action: "generate" | "save" | "publish", fn: () => Promise<void>) => {
    setBusy(action)
    try {
      await fn()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className={cn("group bg-white border rounded-xl transition-all", isSelected ? "border-blue-500 ring-1 ring-blue-500 shadow-md" : "border-zinc-200 hover:border-zinc-300 shadow-sm")}>
      <div className="flex items-start p-5 gap-4">
        <div className="pt-1">
          <button
            onClick={onToggle}
            className={cn("h-5 w-5 rounded border flex items-center justify-center transition-colors", isSelected ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-zinc-300 group-hover:border-blue-400")}
          >
            {isSelected ? <Check className="h-3.5 w-3.5" /> : null}
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-zinc-900 truncate">{review.reviewer.displayName ?? "Anonymous"}</span>
              <span className="text-xs text-zinc-400">•</span>
              <span className="text-xs text-zinc-500 shrink-0">{formatAge(review.createTimeIso)} ago</span>
            </div>
            <div className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border", statusClass)}>{review.status}</div>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <Stars rating={review.starRating} size="sm" />
            <div className="flex items-center gap-1 text-xs text-zinc-500">
              <MapPin className="h-3 w-3" />
              {review.location.displayName}
            </div>
            {review.draftStatus === "BLOCKED_BY_VERIFIER" ? (
              <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full">
                <AlertTriangle className="h-3 w-3" />
                Flagged
              </div>
            ) : null}
          </div>

          <p className="text-sm text-zinc-700 leading-relaxed mb-4">{review.comment || "No written comment provided."}</p>

          {review.status === "pending" ? (
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-blue-700 text-xs font-bold uppercase tracking-wide">
                  <Sparkles className="h-3.5 w-3.5" />
                  AI Suggested Draft
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setIsEditing((v) => !v)} className="text-xs font-semibold text-blue-600 hover:underline">
                    {isEditing ? "Cancel" : "Edit Draft"}
                  </button>
                  <button
                    onClick={() => run("generate", () => onGenerate(review.id))}
                    className="text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    {busy === "generate" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    Regenerate
                  </button>
                </div>
              </div>

              {isEditing ? (
                <textarea
                  className="w-full bg-white border border-blue-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3 min-h-[100px]"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
              ) : (
                <p className="text-sm text-blue-900 italic mb-4">&quot;{draft || "No draft yet. Click regenerate."}&quot;</p>
              )}

              <div className="flex gap-2">
                {isEditing ? (
                  <button
                    onClick={() => run("save", () => onSave(review.id, draft))}
                    className="bg-zinc-800 hover:bg-zinc-900 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-2"
                  >
                    {busy === "save" ? <RefreshCw className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                    Save Draft
                  </button>
                ) : null}
                <button
                  onClick={() => run("publish", () => onPublish(review.id, draft, review))}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-70"
                  disabled={!draft.trim() || busy === "publish"}
                >
                  {busy === "publish" ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  Approve & Post
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 pt-4 border-t border-zinc-100 flex gap-3">
              <div className="h-8 w-8 bg-zinc-100 rounded-lg flex items-center justify-center shrink-0">
                <Globe className="h-4 w-4 text-zinc-400" />
              </div>
              <div className="bg-zinc-50 rounded-xl p-3 flex-1">
                <p className="text-xs font-bold text-zinc-500 uppercase mb-1">Your Response</p>
                <p className="text-sm text-zinc-700">{review.reply.comment}</p>
              </div>
            </div>
          )}
        </div>

        <button className="p-1 text-zinc-300 hover:text-zinc-500 transition-colors">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}

export function BlitzMode({
  reviews,
  onClose,
  onGenerate,
  onPublish,
}: {
  reviews: ReviewRow[]
  onClose: () => void
  onGenerate: (reviewId: string) => Promise<void>
  onPublish: (reviewId: string, text: string, row: ReviewRow) => Promise<void>
}) {
  const [index, setIndex] = React.useState(0)
  const current = reviews[index]
  const [draft, setDraft] = React.useState("")
  const [busy, setBusy] = React.useState<"generate" | "publish" | null>(null)

  React.useEffect(() => {
    if (!current) return
    setDraft(current.currentDraft?.text ?? "")
  }, [current])

  if (!current) return null

  const goNext = () => {
    if (index < reviews.length - 1) setIndex((v) => v + 1)
    else onClose()
  }

  const run = async (action: "generate" | "publish", fn: () => Promise<void>) => {
    setBusy(action)
    try {
      await fn()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed")
    } finally {
      setBusy(null)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-white z-[100] flex flex-col">
      <header className="h-20 border-b border-zinc-200 flex items-center justify-between px-8">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
            <X className="h-6 w-6 text-zinc-500" />
          </button>
          <div className="h-1 bg-zinc-100 w-48 rounded-full overflow-hidden">
            <motion.div className="h-full bg-blue-600" animate={{ width: `${((index + 1) / reviews.length) * 100}%` }} />
          </div>
          <span className="text-sm font-bold text-zinc-500">{index + 1} / {reviews.length}</span>
        </div>
        <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest">
          <Zap className="h-4 w-4" />
          Quick Reply Mode
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="lg:w-1/2 p-8 lg:p-20 overflow-y-auto bg-[#f9fafb] border-r border-zinc-200 flex items-center justify-center">
          <div className="max-w-md w-full">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-14 w-14 rounded-full bg-white shadow-sm border border-zinc-100 flex items-center justify-center text-xl font-black text-blue-600">
                {(current.reviewer.displayName ?? "A").slice(0, 1).toUpperCase()}
              </div>
              <div>
                <h2 className="text-2xl font-black text-zinc-900">{current.reviewer.displayName ?? "Anonymous"}</h2>
                <p className="text-zinc-500 font-medium">{current.location.displayName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <Stars rating={current.starRating} />
              <span className="text-sm text-zinc-400 font-bold ml-2 uppercase tracking-tighter">Posted {formatAge(current.createTimeIso)} ago</span>
            </div>
            <blockquote className="text-2xl font-serif text-zinc-800 leading-snug mb-10">&quot;{current.comment}&quot;</blockquote>
          </div>
        </div>

        <div className="lg:w-1/2 p-8 lg:p-20 flex flex-col justify-center">
          <div className="max-w-xl w-full mx-auto">
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-black text-zinc-500 uppercase tracking-widest">AI Proposed Response</label>
              <button onClick={() => run("generate", () => onGenerate(current.id))} className="flex items-center gap-2 text-blue-600 text-xs font-bold hover:underline">
                {busy === "generate" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Regenerate
              </button>
            </div>

            <textarea
              className="w-full h-64 border-2 border-blue-600 rounded-3xl p-8 text-lg text-zinc-800 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all shadow-xl shadow-blue-500/5 mb-8"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />

            <div className="flex items-center gap-4">
              <button onClick={goNext} className="flex-1 py-5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-black uppercase tracking-widest rounded-2xl transition-all">
                Skip
              </button>
              <button
                onClick={() => run("publish", async () => { await onPublish(current.id, draft, current); goNext() })}
                className="flex-[2] py-5 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-3 disabled:opacity-70"
                disabled={!draft.trim() || busy === "publish"}
              >
                {busy === "publish" ? <RefreshCw className="h-6 w-6 animate-spin" /> : "Publish & Next"}
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
