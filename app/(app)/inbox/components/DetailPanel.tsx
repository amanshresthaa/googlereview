"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"

import { initials } from "../model"
import { Stars } from "./Stars"
import { formatAge } from "@/lib/hooks"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { CheckCircle2, Clock, Copy, Edit, MapPin, RefreshCw, Save, Send, ShieldCheck, Sparkles, X, MessageSquare } from "@/components/icons"

import type { ReviewRow } from "@/lib/hooks"

type DetailPanelProps = {
  row: ReviewRow
  onGenerate: (reviewId: string) => Promise<void>
  onSave: (reviewId: string, text: string) => Promise<void>
  onVerify: (reviewId: string) => Promise<void>
  onPublish: (reviewId: string, text: string, row: ReviewRow) => Promise<void>
}

export function DetailPanel({ row, onGenerate, onSave, onVerify, onPublish }: DetailPanelProps) {
  const [text, setText] = React.useState(row.currentDraft?.text ?? "")
  const [busy, setBusy] = React.useState<null | "generate" | "save" | "verify" | "publish">(null)

  React.useEffect(() => {
    setText(row.currentDraft?.text ?? "")
  }, [row.id, row.currentDraft?.id, row.currentDraft?.text])

  const hasText = text.trim().length > 0
  const isDirty = text !== (row.currentDraft?.text ?? "")
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length
  const characterCount = text.length

  const run = async (action: NonNullable<typeof busy>, fn: () => Promise<void>) => {
    setBusy(action)
    try {
      await fn()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed")
    } finally {
      setBusy(null)
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Copied to clipboard")
    } catch {
      toast.error("Failed to copy")
    }
  }

  const isReplied = row.status === "replied"
  const isVerified = row.draftStatus === "READY"

  return (
    <div className="flex h-full flex-col bg-background">
      <ScrollArea className="flex-1">
        <div className="p-6 md:p-8 space-y-8 max-w-4xl mx-auto">
          {/* Header Area */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 border-2 border-primary/5 shadow-sm">
                <AvatarFallback className="bg-primary/5 text-lg font-black text-primary">
                  {initials(row.reviewer.displayName ?? "Anonymous")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h2 className="text-xl font-black tracking-tight text-foreground truncate max-w-[240px]">
                  {row.reviewer.displayName || "Anonymous"}
                </h2>
                <div className="flex items-center gap-3 mt-1">
                  <Stars rating={row.starRating} size="xs" />
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                    <Clock className="h-3 w-3" />
                    {formatAge(row.createTimeIso)} ago
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <AnimatePresence mode="wait">
                <motion.div
                  key={isReplied ? "replied" : isVerified ? "verified" : "pending"}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  {isReplied ? (
                    <Badge className="rounded-full bg-emerald-500/10 text-emerald-600 border-none px-3 py-1 font-black text-[10px] uppercase tracking-widest shadow-sm">
                      <CheckCircle2 className="mr-1.5 h-3 w-3" />
                      Published
                    </Badge>
                  ) : isVerified ? (
                    <Badge className="rounded-full bg-primary/10 text-primary border-none px-3 py-1 font-black text-[10px] uppercase tracking-widest shadow-sm">
                      <ShieldCheck className="mr-1.5 h-3 w-3" />
                      AI Verified
                    </Badge>
                  ) : (
                    <Badge className="rounded-full bg-muted text-muted-foreground border-none px-3 py-1 font-black text-[10px] uppercase tracking-widest">
                      Pending
                    </Badge>
                  )}
                </motion.div>
              </AnimatePresence>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                <MapPin className="h-3 w-3" />
                {row.location.displayName}
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="space-y-6">
            <div className="relative">
              <div className="absolute -left-3 top-0 bottom-0 w-1 rounded-full bg-primary/10" />
              <p className="text-lg md:text-xl leading-relaxed text-foreground font-medium italic pl-4">
                &ldquo;{row.comment || "No written comment provided."}&rdquo;
              </p>
              {row.mentions.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 pl-4">
                  {row.mentions.map((mention) => (
                    <span key={mention} className="text-[10px] font-black uppercase tracking-widest text-primary/60 bg-primary/5 px-2 py-0.5 rounded-md">
                      #{mention}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="h-px bg-border/50" />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                  {isReplied ? "Official Response" : "Drafting Dashboard"}
                </h3>
                {!isReplied && (
                  <div className="flex items-center gap-4 text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest">
                    <span>{wordCount} words</span>
                    <span>{characterCount} chars</span>
                  </div>
                )}
              </div>

              {isReplied ? (
                <div className="rounded-[24px] bg-emerald-500/[0.02] border border-emerald-500/10 p-6 shadow-inner transition-all hover:bg-emerald-500/[0.04]">
                  <p className="text-base leading-relaxed text-foreground font-medium">
                    {row.reply.comment}
                  </p>
                </div>
              ) : (
                <div className="relative group">
                  <Textarea
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    placeholder="Compose your response..."
                    className={cn(
                      "min-h-[320px] rounded-[24px] border-border/50 bg-muted/20 p-6 text-base leading-relaxed shadow-inner transition-all focus:bg-background focus:border-primary/30 focus:ring-4 focus:ring-primary/5",
                      busy === "generate" && "pointer-events-none opacity-50",
                    )}
                  />
                  <AnimatePresence>
                    {busy === "generate" && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-10 rounded-[24px] bg-background/40 backdrop-blur-sm flex items-center justify-center"
                      >
                        <motion.div
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="flex flex-col items-center gap-3 text-primary"
                        >
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          >
                            <RefreshCw className="h-8 w-8" />
                          </motion.div>
                          <p className="text-xs font-black uppercase tracking-widest">Generating AI Response</p>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {!hasText && !busy && (
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground/30">
                      <Edit className="h-10 w-10" />
                      <p className="text-sm font-black uppercase tracking-widest">Start Typing</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>

      {!isReplied && (
        <div className="border-t border-border/50 bg-background/80 glass-sm p-4 md:p-6">
          <div className="mx-auto flex w-full max-w-4xl flex-col sm:flex-row items-center gap-4">
            <div className="flex w-full sm:flex-1 items-center gap-2">
              <Button
                type="button"
                className="h-12 flex-1 rounded-2xl bg-primary font-black shadow-glow-primary transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                disabled={!hasText || busy !== null}
                onClick={() => run("publish", () => onPublish(row.id, text, row))}
              >
                {busy === "publish" ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <RefreshCw className="mr-2 h-5 w-5" />
                  </motion.div>
                ) : (
                  <Send className="mr-2 h-5 w-5" />
                )}
                Publish Reply
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-12 w-12 rounded-2xl border-border/50 bg-background shadow-sm hover:bg-muted/50 transition-all flex shrink-0 items-center justify-center"
                disabled={busy !== null}
                onClick={() => run("generate", () => onGenerate(row.id))}
                aria-label="Regenerate"
              >
                {busy === "generate" ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <RefreshCw className="h-5 w-5 text-primary" />
                  </motion.div>
                ) : (
                  <Sparkles className="h-5 w-5 text-primary" />
                )}
              </Button>
            </div>

            <div className="flex w-full sm:w-auto items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-12 px-6 rounded-2xl font-bold border-border/50 bg-background shadow-sm hover:bg-muted/50 transition-all"
                disabled={!isDirty || !hasText || busy !== null}
                onClick={() => run("save", () => onSave(row.id, text))}
              >
                {busy === "save" ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                    </motion.div>
                    Save
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </>
                )}
              </Button>

              <div className="flex items-center gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-12 w-12 rounded-2xl transition-all hover:bg-muted/80"
                        disabled={!hasText || busy !== null}
                        onClick={() => run("verify", () => onVerify(row.id))}
                      >
                        {busy === "verify" ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          >
                            <RefreshCw className="h-5 w-5 text-primary" />
                          </motion.div>
                        ) : (
                          <ShieldCheck className="h-5 w-5 text-primary" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="font-bold">Verify Draft</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-12 w-12 rounded-2xl transition-all hover:bg-muted/80"
                        disabled={!hasText || busy !== null}
                        onClick={() => void copyToClipboard()}
                      >
                        <Copy className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="font-bold">Copy to Clipboard</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-12 w-12 rounded-2xl transition-all hover:bg-muted/80 text-muted-foreground/40 hover:text-destructive"
                        disabled={busy !== null}
                        onClick={() => setText(row.currentDraft?.text ?? "")}
                      >
                        <X className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="font-bold">Reset Changes</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}



