"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { withIdempotencyHeader } from "@/lib/api/client-idempotency"
import { cn } from "@/lib/utils"
import {
  CheckCircle2,
  Globe,
  Loader2,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  X,
  Zap,
} from "@/components/icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { SeoProfilesEditor, type SeoLocationProfilePayload } from "@/app/(app)/settings/seo-profiles-editor"

type SettingsShape = {
  tonePreset: string
  toneCustomInstructions: string | null
  autoDraftEnabled: boolean
  autoDraftForRatings: number[]
  bulkApproveEnabledForFiveStar: boolean
  mentionKeywords: string[]
}

type Props = {
  orgName: string
  googleConnection: { status: string; googleEmail: string; scopes: string[] } | null
  locations: Array<{
    id: string
    displayName: string
    seoPrimaryKeywords: string[]
    seoSecondaryKeywords: string[]
    seoGeoTerms: string[]
  }>
  settings: SettingsShape
  showBulkApprove?: boolean
}

const TONE_PRESETS = ["friendly", "professional", "empathetic", "concise", "upbeat"] as const

function isValidKeyword(raw: string) {
  const value = raw.trim().toLowerCase()
  if (value.length < 1 || value.length > 32) return null
  return value
}

export function SettingsClient({
  orgName,
  googleConnection,
  locations,
  settings,
  showBulkApprove = true,
}: Props) {
  const router = useRouter()

  const [saving, setSaving] = React.useState(false)
  const [savingSeo, setSavingSeo] = React.useState(false)
  const [draft, setDraft] = React.useState<SettingsShape>(settings)
  const [keywordInput, setKeywordInput] = React.useState("")
  const [activeTab, setActiveTab] = React.useState("general")

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

  const saveSeoProfiles = async (profiles: SeoLocationProfilePayload[]) => {
    setSavingSeo(true)
    try {
      const res = await fetch("/api/settings/seo-locations", {
        method: "POST",
        headers: withIdempotencyHeader({ "content-type": "application/json" }),
        body: JSON.stringify({
          locations: profiles.map((profile) => ({
            locationId: profile.locationId,
            primaryKeywords: profile.primaryKeywords,
            secondaryKeywords: profile.secondaryKeywords,
            geoTerms: profile.geoTerms,
          })),
        }),
      })
      if (res.status === 401) {
        router.replace("/signin")
        return
      }
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? res.statusText)
      toast.success("SEO profiles saved")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingSeo(false)
      router.refresh()
    }
  }

  const addKeyword = () => {
    const value = isValidKeyword(keywordInput)
    if (!value) {
      toast.error("Keyword must be 1-32 characters.")
      return
    }
    if (draft.mentionKeywords.includes(value)) {
      setKeywordInput("")
      return
    }
    if (draft.mentionKeywords.length >= 30) {
      toast.error("Maximum 30 keywords.")
      return
    }
    setDraft((prev) => ({ ...prev, mentionKeywords: [...prev.mentionKeywords, value] }))
    setKeywordInput("")
  }

  const removeKeyword = (keyword: string) => {
    setDraft((prev) => ({ ...prev, mentionKeywords: prev.mentionKeywords.filter((x) => x !== keyword) }))
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-muted md:h-12 md:w-12">
          <Settings className="size-5 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">Settings</h1>
          <p className="text-sm text-muted-foreground">Configure automation and AI behavior</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex h-auto flex-wrap gap-1 rounded-xl bg-muted p-1">
          <TabsTrigger value="general" className="rounded-lg text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <Globe className="mr-1.5 h-3.5 w-3.5" />
            General
          </TabsTrigger>
          <TabsTrigger value="automation" className="rounded-lg text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <Zap className="mr-1.5 h-3.5 w-3.5" />
            Automation
          </TabsTrigger>
          <TabsTrigger value="seo" className="rounded-lg text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            SEO
          </TabsTrigger>
          <TabsTrigger value="tone" className="rounded-lg text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
            Tone
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="h-4 w-4 text-muted-foreground" />
                Organization
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 rounded-xl border border-border bg-muted/50 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{orgName}</p>
                  <p className="text-xs text-muted-foreground">Organization name</p>
                </div>
              </div>

              <Separator className="bg-border" />

              <div className="space-y-3">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Google Connection
                </Label>
                {googleConnection ? (
                  <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-muted/50 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{googleConnection.googleEmail}</p>
                      <p className="text-xs text-muted-foreground">{googleConnection.scopes.length} scopes granted</p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-xs font-medium",
                        googleConnection.status === "ACTIVE"
                          ? "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
                          : "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",
                      )}
                    >
                      {googleConnection.status === "ACTIVE" ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </span>
                      ) : (
                        googleConnection.status
                      )}
                    </Badge>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center">
                    <Globe className="mb-3 h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm font-medium text-foreground">Not connected</p>
                    <p className="mt-1 text-xs text-muted-foreground">Connect your Google account to sync reviews</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automation" className="space-y-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="h-4 w-4 text-muted-foreground" />
                Auto Draft
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Enable auto draft</Label>
                  <p className="text-xs text-muted-foreground">Automatically generate AI drafts for new reviews</p>
                </div>
                <Switch
                  checked={draft.autoDraftEnabled}
                  onCheckedChange={(value) => setDraft((prev) => ({ ...prev, autoDraftEnabled: value }))}
                  aria-label="Toggle auto draft"
                />
              </div>

              <div className={cn("space-y-3", !draft.autoDraftEnabled && "pointer-events-none opacity-50")}>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Draft for ratings
                </Label>
                <ToggleGroup
                  type="multiple"
                  value={draft.autoDraftForRatings.map(String)}
                  disabled={!draft.autoDraftEnabled}
                  onValueChange={(values) => {
                    const next = values
                      .map(Number)
                      .filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= 5)
                      .sort((a, b) => a - b)
                    setDraft((prev) => ({ ...prev, autoDraftForRatings: next }))
                  }}
                  className="flex flex-wrap justify-start gap-2 bg-transparent p-0"
                  aria-label="Select ratings for auto draft"
                >
                  {ratings.map((rating) => {
                    const isActive = selectedRatings.has(rating)
                    return (
                      <ToggleGroupItem
                        key={rating}
                        value={String(rating)}
                        aria-label={`${rating} star${rating !== 1 ? "s" : ""}`}
                        className={cn(
                          "inline-flex h-9 items-center gap-1 rounded-xl border px-4 text-xs font-semibold transition-all",
                          isActive
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {rating}
                        <Star className="h-3 w-3" weight={isActive ? "fill" : "regular"} />
                      </ToggleGroupItem>
                    )
                  })}
                </ToggleGroup>
              </div>

              <Separator className="bg-border" />

              {showBulkApprove ? (
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Bulk approve 5-star</Label>
                    <p className="text-xs text-muted-foreground">Allow one-click bulk posting for ready 5-star drafts</p>
                  </div>
                  <Switch
                    checked={draft.bulkApproveEnabledForFiveStar}
                    onCheckedChange={(value) =>
                      setDraft((prev) => ({ ...prev, bulkApproveEnabledForFiveStar: value }))
                    }
                    aria-label="Toggle bulk approve"
                  />
                </div>
              ) : null}

              <div className="flex flex-col sm:flex-row sm:justify-end pt-2 gap-2">
                <Button
                  size="sm"
                  disabled={saving}
                  onClick={() =>
                    submit({
                      autoDraftEnabled: draft.autoDraftEnabled,
                      autoDraftForRatings: draft.autoDraftForRatings,
                      ...(showBulkApprove && {
                        bulkApproveEnabledForFiveStar: draft.bulkApproveEnabledForFiveStar,
                      }),
                    })
                  }
                  className="w-full sm:w-auto min-w-[100px]"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seo" className="space-y-4">
          <SeoProfilesEditor
            initialProfiles={locations.map((location) => ({
              locationId: location.id,
              displayName: location.displayName,
              primaryKeywords: location.seoPrimaryKeywords,
              secondaryKeywords: location.seoSecondaryKeywords,
              geoTerms: location.seoGeoTerms,
            }))}
            saving={savingSeo}
            onSave={saveSeoProfiles}
          />
        </TabsContent>

        <TabsContent value="tone" className="space-y-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                AI Tone
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Model Runtime
                </Label>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
                  <ShieldCheck className="h-4 w-4" />
                  OpenAI via DSPy service
                </div>
              </div>

              <Separator className="bg-border" />

              <div className="space-y-3">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tone Preset
                </Label>
                <ToggleGroup
                  type="single"
                  value={draft.tonePreset}
                  onValueChange={(value) => value && setDraft((prev) => ({ ...prev, tonePreset: value }))}
                  className="flex flex-wrap justify-start gap-2 bg-transparent p-0"
                  aria-label="Select tone preset"
                >
                  {TONE_PRESETS.map((tone) => {
                    const isActive = draft.tonePreset === tone
                    return (
                      <ToggleGroupItem
                        key={tone}
                        value={tone}
                        aria-label={tone}
                        className={cn(
                          "h-9 rounded-xl border px-4 text-xs font-semibold capitalize transition-all",
                          isActive
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {tone}
                      </ToggleGroupItem>
                    )
                  })}
                </ToggleGroup>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Custom Instructions
                </Label>
                <Textarea
                  className="resize-none rounded-xl border-border focus-visible:ring-primary/30"
                  value={draft.toneCustomInstructions ?? ""}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, toneCustomInstructions: event.target.value || null }))
                  }
                  placeholder="Optional. Example: Keep replies under 70 words..."
                  rows={3}
                  aria-label="Custom tone instructions"
                />
              </div>

              <Separator className="bg-border" />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Mention Keywords
                  </Label>
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {draft.mentionKeywords.length}/30
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    className="h-9 rounded-xl border-border"
                    value={keywordInput}
                    placeholder="Add keyword (e.g., staff)"
                    onChange={(event) => setKeywordInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault()
                        addKeyword()
                      }
                    }}
                    aria-label="Add mention keyword"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addKeyword}
                    className="h-9 rounded-xl"
                  >
                    Add
                  </Button>
                </div>
                {draft.mentionKeywords.length > 0 ? (
                  <div className="flex flex-wrap gap-2" role="list" aria-label="Mention keywords">
                    {draft.mentionKeywords.map((keyword) => (
                      <Badge
                        key={keyword}
                        variant="secondary"
                        className="gap-1.5 rounded-lg border-border bg-muted px-2.5 py-1 text-xs"
                        role="listitem"
                      >
                        {keyword}
                        <button
                          type="button"
                          onClick={() => removeKeyword(keyword)}
                          className="text-muted-foreground transition-colors hover:text-foreground"
                          aria-label={`Remove ${keyword}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-end pt-2 gap-2">
                <Button
                  size="sm"
                  disabled={saving}
                  onClick={() =>
                    submit({
                      tonePreset: draft.tonePreset,
                      toneCustomInstructions: draft.toneCustomInstructions,
                      mentionKeywords: draft.mentionKeywords,
                    })
                  }
                  className="w-full sm:w-auto min-w-[100px]"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
