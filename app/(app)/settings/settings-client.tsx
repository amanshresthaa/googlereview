"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { withIdempotencyHeader } from "@/lib/api/client-idempotency"
import { cn } from "@/lib/utils"
import { X, Star, Settings, Sparkles, Zap, Globe, Loader2, CheckCircle2 } from "@/components/icons"

type SettingsShape = {
  tonePreset: string
  toneCustomInstructions: string | null
  autoDraftEnabled: boolean
  autoDraftForRatings: number[]
  bulkApproveEnabledForFiveStar: boolean
  aiProvider: "OPENAI" | "GEMINI"
  mentionKeywords: string[]
}

type Props = {
  orgName: string
  googleConnection: { status: string; googleEmail: string; scopes: string[] } | null
  settings: SettingsShape
  showBulkApprove?: boolean
}

const TONE_PRESETS = ["friendly", "professional", "empathetic", "concise", "upbeat"] as const

function isValidKeyword(raw: string) {
  const v = raw.trim().toLowerCase()
  if (v.length < 1 || v.length > 32) return null
  return v
}

export function SettingsClient({ orgName, googleConnection, settings, showBulkApprove = true }: Props) {
  const router = useRouter()

  const [saving, setSaving] = React.useState(false)
  const [draft, setDraft] = React.useState<SettingsShape>(settings)
  const [keywordInput, setKeywordInput] = React.useState("")

  const ratings = [1, 2, 3, 4, 5] as const
  const selectedRatings = React.useMemo(() => new Set(draft.autoDraftForRatings), [draft.autoDraftForRatings])

  const submit = async (patch: Partial<SettingsShape>) => {
    setSaving(true)
    try {
      const res = await fetch("/api/settings/update", {
        method: "POST",
        headers: withIdempotencyHeader({ "content-type": "application/json" }),
        body: JSON.stringify(patch),
      })
      if (res.status === 401) {
        router.replace("/signin")
        return
      }
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? res.statusText)
      toast.success("Settings saved")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
      router.refresh()
    }
  }

  const addKeyword = () => {
    const v = isValidKeyword(keywordInput)
    if (!v) {
      toast.error("Keyword must be 1-32 characters.")
      return
    }
    if (draft.mentionKeywords.includes(v)) {
      setKeywordInput("")
      return
    }
    if (draft.mentionKeywords.length >= 30) {
      toast.error("Maximum 30 keywords.")
      return
    }
    setDraft((prev) => ({ ...prev, mentionKeywords: [...prev.mentionKeywords, v] }))
    setKeywordInput("")
  }

  const removeKeyword = (k: string) => {
    setDraft((prev) => ({ ...prev, mentionKeywords: prev.mentionKeywords.filter((x) => x !== k) }))
  }

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center border border-border">
          <Settings className="size-5 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground font-medium">Configure automation and AI behavior</p>
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="bg-muted p-1 rounded-xl h-10 border border-border">
          <TabsTrigger value="general" className="text-xs rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-card data-[state=active]:text-foreground text-muted-foreground font-medium">General</TabsTrigger>
          <TabsTrigger value="automation" className="text-xs rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-card data-[state=active]:text-foreground text-muted-foreground font-medium">Automation</TabsTrigger>
          <TabsTrigger value="tone" className="text-xs rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-card data-[state=active]:text-foreground text-muted-foreground font-medium">AI Tone</TabsTrigger>
        </TabsList>

        {/* ─── General ─── */}
        <TabsContent value="general" className="space-y-5">
          <Card className="rounded-2xl border-border bg-card shadow-card">
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center border border-border">
                  <Globe className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-foreground">Organization</div>
                  <div className="text-xs text-muted-foreground truncate font-medium">{orgName}</div>
                </div>
              </div>

              <Separator className="bg-border" />

              <div className="space-y-4">
                <div className="text-sm font-bold text-foreground">Google Connection</div>
                {googleConnection ? (
                  <div className="rounded-2xl border border-border bg-muted/50 p-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-card border border-border flex items-center justify-center shadow-sm">
                        <Globe className="size-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate text-foreground">{googleConnection.googleEmail}</div>
                      </div>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "rounded-lg px-3 py-1.5 text-xs font-medium",
                          googleConnection.status === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700"
                        )}
                      >
                        {googleConnection.status === "ACTIVE" ? (
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="size-3" /> Active
                          </span>
                        ) : (
                          googleConnection.status
                        )}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary" className="rounded-md font-mono text-[9px] px-2 h-5 bg-muted text-muted-foreground">
                        {googleConnection.scopes.length} scope{googleConnection.scopes.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center">
                    <p className="text-sm text-muted-foreground font-medium">Not connected</p>
                    <p className="text-xs text-muted-foreground mt-1">Connect your Google account to sync reviews</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Automation ─── */}
        <TabsContent value="automation" className="space-y-5">
          <Card className="rounded-2xl border-border bg-card shadow-card">
            <CardContent className="p-6 space-y-6">
              {/* Auto-draft */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 mt-0.5">
                    <Sparkles className="size-4 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-foreground">Auto draft</div>
                    <div className="text-xs text-muted-foreground leading-relaxed max-w-[280px] font-medium">
                      Automatically generate AI drafts for incoming reviews.
                    </div>
                  </div>
                </div>
                <Switch
                  checked={draft.autoDraftEnabled}
                  onCheckedChange={(v) => setDraft((p) => ({ ...p, autoDraftEnabled: v }))}
                />
              </div>

              <div className={cn("pl-14 space-y-3", !draft.autoDraftEnabled && "opacity-40 pointer-events-none")}>
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Draft for ratings</div>
                <ToggleGroup
                  type="multiple"
                  value={draft.autoDraftForRatings.map(String)}
                  disabled={!draft.autoDraftEnabled}
                  onValueChange={(values) => {
                    const next = values
                      .map((value) => Number(value))
                      .filter((value): value is number => Number.isInteger(value) && value >= 1 && value <= 5)
                      .sort((a, b) => a - b)
                    setDraft((p) => ({ ...p, autoDraftForRatings: next }))
                  }}
                  className="flex flex-wrap justify-start gap-2 bg-transparent p-0"
                >
                  {ratings.map((r) => {
                    const active = selectedRatings.has(r)
                    return (
                      <ToggleGroupItem
                        key={r}
                        value={String(r)}
                        className={cn(
                          "h-9 px-4 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all border",
                          active
                            ? "bg-primary/10 text-primary border-primary/30"
                            : "bg-card text-muted-foreground border-border hover:bg-accent"
                        )}
                      >
                        {r}
                        <Star className="size-3" weight={active ? "fill" : "regular"} />
                      </ToggleGroupItem>
                    )
                  })}
                </ToggleGroup>
              </div>

              {showBulkApprove ? (
                <>
                  <Separator className="bg-border" />

                  {/* Bulk approve */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100 mt-0.5">
                        <Zap className="size-4 text-emerald-600" />
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-bold text-foreground">Bulk approve 5-star</div>
                        <div className="text-xs text-muted-foreground leading-relaxed max-w-[280px] font-medium">
                          Enable one-click bulk posting for ready 5-star drafts.
                        </div>
                      </div>
                    </div>
                    <Switch
                      checked={draft.bulkApproveEnabledForFiveStar}
                      onCheckedChange={(v) => setDraft((p) => ({ ...p, bulkApproveEnabledForFiveStar: v }))}
                    />
                  </div>
                </>
              ) : null}

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  size="sm"
                  className="rounded-xl gap-2 h-9 text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-elevated min-w-[100px]"
                  disabled={saving}
                  onClick={() =>
                    submit({
                      autoDraftEnabled: draft.autoDraftEnabled,
                      autoDraftForRatings: draft.autoDraftForRatings,
                      ...(showBulkApprove
                        ? { bulkApproveEnabledForFiveStar: draft.bulkApproveEnabledForFiveStar }
                        : {}),
                    })
                  }
                >
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── AI Tone ─── */}
        <TabsContent value="tone" className="space-y-5">
          <Card className="rounded-2xl border-border bg-card shadow-card">
            <CardContent className="p-6 space-y-6">
              {/* AI Provider */}
              <div className="space-y-3">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">AI Provider</Label>
                <Select
                  value={draft.aiProvider}
                  onValueChange={(v) => setDraft((p) => ({ ...p, aiProvider: v as "OPENAI" | "GEMINI" }))}
                >
                  <SelectTrigger className="rounded-xl border-border h-10 bg-card">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="OPENAI">
                      <div className="flex items-center gap-2.5">
                        <div className="h-6 w-6 rounded-lg bg-foreground text-background flex items-center justify-center text-[9px] font-bold">AI</div>
                        OpenAI
                      </div>
                    </SelectItem>
                    <SelectItem value="GEMINI">
                      <div className="flex items-center gap-2.5">
                        <div className="h-6 w-6 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-[9px] font-bold">G</div>
                        Gemini
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator className="bg-border" />

              {/* Tone Preset */}
              <div className="space-y-3">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Tone Preset</Label>
                <ToggleGroup
                  type="single"
                  value={draft.tonePreset}
                  onValueChange={(value) => {
                    if (!value) return
                    setDraft((p) => ({ ...p, tonePreset: value }))
                  }}
                  className="flex flex-wrap justify-start gap-2 bg-transparent p-0"
                >
                  {TONE_PRESETS.map((t) => {
                    const active = draft.tonePreset === t
                    return (
                      <ToggleGroupItem
                        key={t}
                        value={t}
                        className={cn(
                          "h-9 px-4 rounded-xl text-xs font-semibold capitalize transition-all border",
                          active
                            ? "bg-primary/10 text-primary border-primary/30"
                            : "bg-card text-muted-foreground border-border hover:bg-accent"
                        )}
                      >
                        {t}
                      </ToggleGroupItem>
                    )
                  })}
                </ToggleGroup>
              </div>

              {/* Custom Instructions */}
              <div className="space-y-3">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Custom Instructions</Label>
                <Textarea
                  className="rounded-xl resize-none text-sm border-border focus-visible:ring-ring/30 focus-visible:ring-4"
                  value={draft.toneCustomInstructions ?? ""}
                  onChange={(e) => setDraft((p) => ({ ...p, toneCustomInstructions: e.target.value || null }))}
                  placeholder="Optional. Example: Keep replies under 70 words and avoid exclamation marks."
                  rows={4}
                />
              </div>

              <Separator className="bg-border" />

              {/* Mention Keywords */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Mention Keywords</Label>
                  <Badge variant="secondary" className="rounded-md font-mono text-[9px] h-5 px-2 bg-muted text-muted-foreground">
                    {draft.mentionKeywords.length}/30
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    className="rounded-xl h-10 text-sm border-border"
                    value={keywordInput}
                    placeholder="Add keyword (e.g., staff)"
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addKeyword()
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl h-10 text-xs border-border font-semibold"
                    onClick={addKeyword}
                  >
                    Add
                  </Button>
                </div>
                {draft.mentionKeywords.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {draft.mentionKeywords.map((k) => (
                      <Badge key={k} variant="secondary" className="rounded-lg gap-2 px-3 h-7 text-xs bg-muted text-muted-foreground hover:bg-accent border border-border">
                        {k}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-foreground rounded-sm p-0.5 transition-colors h-4 w-4"
                          onClick={() => removeKeyword(k)}
                          aria-label={`Remove ${k}`}
                        >
                          <X className="size-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  size="sm"
                  className="rounded-xl gap-2 h-9 text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-elevated min-w-[100px]"
                  disabled={saving}
                  onClick={() =>
                    submit({
                      aiProvider: draft.aiProvider,
                      tonePreset: draft.tonePreset,
                      toneCustomInstructions: draft.toneCustomInstructions,
                      mentionKeywords: draft.mentionKeywords,
                    })
                  }
                >
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
