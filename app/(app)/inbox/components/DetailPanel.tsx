import * as React from "react"
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
import { CheckCircle2, Copy, MapPin, RefreshCw, Save, Send, ShieldCheck, Sparkles, X } from "@/components/icons"

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

  return (
    <div className="flex h-full flex-col bg-background">
      <ScrollArea className="flex-1">
        <div className="mx-auto w-full max-w-3xl space-y-4 p-4 md:space-y-6 md:p-6">
          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-start gap-3 md:gap-4">
                <Avatar className="h-11 w-11 border md:h-14 md:w-14">
                  <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary md:text-lg">
                    {initials(row.reviewer.displayName ?? "Anonymous")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-foreground md:text-lg">
                      {row.reviewer.displayName || "Anonymous"}
                    </h2>
                    {!row.reviewer.isAnonymous ? <Badge variant="outline">Verified reviewer</Badge> : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground md:text-sm">
                    <Stars rating={row.starRating} />
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {row.location.displayName}
                    </span>
                    <span>•</span>
                    <span>{formatAge(row.createTimeIso)} ago</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Customer review</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
                {row.comment || "No written comment provided."}
              </p>
              {row.mentions.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {row.mentions.map((mention) => (
                    <Badge key={mention} variant="secondary" className="rounded-full text-[11px]">
                      @{mention}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-sm">Business response</CardTitle>
                {isReplied ? (
                  <Badge variant="secondary">
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                    Published
                  </Badge>
                ) : row.currentDraft?.updatedAtIso ? (
                  <Badge variant="outline">Updated {formatAge(row.currentDraft.updatedAtIso)} ago</Badge>
                ) : (
                  <Badge variant="outline">Draft not generated</Badge>
                )}
              </div>
            </CardHeader>

            <CardContent>
              {isReplied ? (
                <div className="rounded-xl border bg-muted/30 p-4">
                  <p className="text-sm leading-relaxed text-foreground md:text-base">{row.reply.comment}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {!row.currentDraft ? (
                    <div className="rounded-xl border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
                      No draft exists yet. Use AI generation or write your own response below.
                    </div>
                  ) : null}

                  <Textarea
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    placeholder="Write a clear, professional response..."
                    className={cn(
                      "min-h-[220px] resize-none text-sm leading-relaxed md:min-h-[260px]",
                      busy === "generate" && "pointer-events-none opacity-70",
                    )}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      {!isReplied ? (
        <div className="border-t bg-background/95 p-3 backdrop-blur md:p-4">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>{wordCount} words</span>
                <span>•</span>
                <span>{characterCount} chars</span>
                {row.draftStatus === "READY" ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Verified
                  </span>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                disabled={busy !== null}
                onClick={() => setText(row.currentDraft?.text ?? "")}
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Reset
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Button
                type="button"
                variant="outline"
                className="col-span-1"
                disabled={busy !== null}
                onClick={() => run("generate", () => onGenerate(row.id))}
              >
                <Sparkles className={cn("mr-1.5 h-4 w-4", busy === "generate" && "animate-spin")} />
                {hasText ? "Regenerate" : "Generate"}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="col-span-1"
                disabled={!hasText || busy !== null}
                onClick={() => run("verify", () => onVerify(row.id))}
              >
                {busy === "verify" ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <ShieldCheck className="mr-1.5 h-4 w-4" />
                    Verify
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="col-span-1"
                disabled={!hasText || busy !== null}
                onClick={() => void copyToClipboard()}
              >
                <Copy className="mr-1.5 h-4 w-4" />
                Copy
              </Button>

              <Button
                type="button"
                variant="outline"
                className="col-span-1"
                disabled={!isDirty || !hasText || busy !== null}
                onClick={() => run("save", () => onSave(row.id, text))}
              >
                {busy === "save" ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Save className="mr-1.5 h-4 w-4" />
                    Save
                  </>
                )}
              </Button>

              <Button
                type="button"
                className="col-span-2 sm:col-span-1"
                disabled={!hasText || busy !== null}
                onClick={() => run("publish", () => onPublish(row.id, text, row))}
              >
                {busy === "publish" ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="mr-1.5 h-4 w-4" />
                    Publish
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
