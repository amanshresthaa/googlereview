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
    <div className="mx-auto max-w-4xl space-y-10 p-6 md:p-10">
      <div className="flex items-center gap-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 shadow-sm transition-transform hover:scale-105">
          <Settings className="size-7 text-primary" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">Command Center</h1>
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Configure intelligence & automation</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <TabsList className="inline-flex h-12 items-center justify-start rounded-2xl bg-muted/30 border border-border/50 p-1.5 gap-1 overflow-x-auto max-w-full">
          {[
            { value: "general", label: "General", icon: Globe },
            { value: "automation", label: "Automation", icon: Zap },
            { value: "seo", label: "SEO Intelligence", icon: Sparkles },
            { value: "tone", label: "AI Tone", icon: ShieldCheck },
          ].map((tab) => (
            <TabsTrigger 
              key={tab.value}
              value={tab.value} 
              className="h-9 rounded-xl px-5 text-xs font-black uppercase tracking-wider transition-all data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              <tab.icon className="mr-2 h-4 w-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          <Card className="rounded-[32px] border-border/50 bg-background shadow-sm overflow-hidden">
            <CardHeader className="pb-6 border-b border-border/50 bg-muted/30">
              <CardTitle className="flex items-center gap-3 text-lg font-black tracking-tight">
                <Globe className="h-5 w-5 text-primary" />
                Organization Identity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-1">
                  Legal Name
                </Label>
                <div className="flex items-center gap-4 rounded-[20px] border border-border/50 bg-muted/20 p-5 shadow-inner">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-bold text-foreground">{orgName}</p>
                    <p className="text-xs font-medium text-muted-foreground">Active organizational profile</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-1">
                  Google Business Connectivity
                </Label>
                {googleConnection ? (
                  <div className="flex flex-wrap items-center gap-5 rounded-[24px] border border-border/50 bg-background p-6 shadow-sm transition-all hover:shadow-card">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/5 border border-primary/10">
                      <Globe className="h-6 w-6 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-base font-bold text-foreground">{googleConnection.googleEmail}</p>
                      <p className="text-xs font-medium text-muted-foreground">{googleConnection.scopes.length} API permissions authorized</p>
                    </div>
                    <Badge
                      className={cn(
                        "rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-widest shadow-sm",
                        googleConnection.status === "ACTIVE"
                          ? "bg-emerald-500/10 text-emerald-600 border-none"
                          : "bg-rose-500/10 text-rose-600 border-none",
                      )}
                    >
                      {googleConnection.status === "ACTIVE" ? (
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3 w-3" />
                          Connected
                        </span>
                      ) : (
                        googleConnection.status
                      )}
                    </Badge>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-[32px] border-2 border-dashed border-border/50 bg-muted/10 p-12 text-center transition-all hover:bg-muted/20">
                    <div className="h-16 w-16 rounded-[24px] bg-background shadow-card border border-border/50 flex items-center justify-center mb-6">
                      <Globe className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground">No Google Connection</h3>
                    <p className="mt-2 text-sm font-medium text-muted-foreground max-w-xs">
                      Connect your verified Google account to begin synchronizing review data.
                    </p>
                    <Button className="mt-8 h-11 rounded-xl px-8 font-black shadow-glow-primary">
                      Connect Account
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          </div>
        </TabsContent>

        <TabsContent value="automation" className="space-y-6">
          <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          <Card className="rounded-[32px] border-border/50 bg-background shadow-sm overflow-hidden">
            <CardHeader className="pb-6 border-b border-border/50 bg-muted/30">
              <CardTitle className="flex items-center gap-3 text-lg font-black tracking-tight">
                <Zap className="h-5 w-5 text-primary" />
                Workflow Automation
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-10">
              <div className="flex items-center justify-between gap-6 p-6 rounded-[24px] bg-primary/[0.02] border border-primary/10 shadow-inner">
                <div className="space-y-1.5">
                  <Label className="text-base font-bold text-foreground">AI Autopilot Drafting</Label>
                  <p className="text-sm font-medium text-muted-foreground">Generate intelligent responses automatically as new reviews arrive.</p>
                </div>
                <Switch
                  checked={draft.autoDraftEnabled}
                  onCheckedChange={(value) => setDraft((prev) => ({ ...prev, autoDraftEnabled: value }))}
                  className="data-[state=checked]:bg-primary shadow-sm"
                />
              </div>

              <div className={cn("space-y-5 transition-all duration-300", !draft.autoDraftEnabled && "pointer-events-none opacity-40 grayscale")}>
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-1">
                  Autopilot Rating Threshold
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
                  className="flex flex-wrap justify-start gap-3 bg-transparent p-0"
                >
                  {ratings.map((rating) => {
                    const isActive = selectedRatings.has(rating)
                    return (
                      <ToggleGroupItem
                        key={rating}
                        value={String(rating)}
                        className={cn(
                          "inline-flex h-12 w-20 items-center justify-center gap-2 rounded-2xl border-2 font-black transition-all",
                          isActive
                            ? "border-primary/30 bg-primary/10 text-primary shadow-sm"
                            : "border-border/50 bg-background text-muted-foreground hover:bg-muted/50",
                        )}
                      >
                        {rating}
                        <Star className="h-4 w-4" weight={isActive ? "fill" : "regular"} />
                      </ToggleGroupItem>
                    )
                  })}
                </ToggleGroup>
              </div>

              {showBulkApprove && (
                <div className="flex items-center justify-between gap-6 p-6 rounded-[24px] bg-emerald-500/[0.02] border border-emerald-500/10 shadow-inner">
                  <div className="space-y-1.5">
                    <Label className="text-base font-bold text-foreground">Instant Bulk Publishing</Label>
                    <p className="text-sm font-medium text-muted-foreground">Enable one-click batch posting for verified 5-star responses.</p>
                  </div>
                  <Switch
                    checked={draft.bulkApproveEnabledForFiveStar}
                    onCheckedChange={(value) =>
                      setDraft((prev) => ({ ...prev, bulkApproveEnabledForFiveStar: value }))
                    }
                    className="data-[state=checked]:bg-emerald-500 shadow-sm"
                  />
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-border/50">
                <Button
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
                  className="h-12 rounded-2xl px-10 font-black bg-primary shadow-glow-primary hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] transition-all min-w-[160px]"
                >
                  {saving ? (
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  ) : null}
                  Save Automation Settings
                </Button>
              </div>
            </CardContent>
          </Card>
          </div>
        </TabsContent>

        <TabsContent value="seo" className="space-y-6">
          <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
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
          </div>
        </TabsContent>

        <TabsContent value="tone" className="space-y-6">
          <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          <Card className="rounded-[32px] border-border/50 bg-background shadow-sm overflow-hidden">
            <CardHeader className="pb-6 border-b border-border/50 bg-muted/30">
              <CardTitle className="flex items-center gap-3 text-lg font-black tracking-tight">
                <ShieldCheck className="h-5 w-5 text-primary" />
                AI Voice & Personality
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-10">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-1">
                  Active Intelligence Model
                </Label>
                <div className="flex items-center gap-4 rounded-[20px] border border-border/50 bg-primary/[0.02] p-5 shadow-inner">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-glow-primary">
                    <Sparkles className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-foreground">GPT-4o Intelligence</p>
                    <p className="text-xs font-medium text-muted-foreground">Deep analysis & semantic mapping via DSPy</p>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-1">
                  Tone Presets
                </Label>
                <ToggleGroup
                  type="single"
                  value={draft.tonePreset}
                  onValueChange={(value) => value && setDraft((prev) => ({ ...prev, tonePreset: value }))}
                  className="flex flex-wrap justify-start gap-3 bg-transparent p-0"
                >
                  {TONE_PRESETS.map((tone) => {
                    const isActive = draft.tonePreset === tone
                    return (
                      <ToggleGroupItem
                        key={tone}
                        value={tone}
                        className={cn(
                          "h-11 rounded-2xl border-2 px-6 text-xs font-black uppercase tracking-widest transition-all",
                          isActive
                            ? "border-primary/30 bg-primary/10 text-primary shadow-sm"
                            : "border-border/50 bg-background text-muted-foreground hover:bg-muted/50",
                        )}
                      >
                        {tone}
                      </ToggleGroupItem>
                    )
                  })}
                </ToggleGroup>
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-1">
                  Custom Brand Directives
                </Label>
                <Textarea
                  className="min-h-[140px] resize-none rounded-[24px] border-border/50 bg-muted/20 p-6 text-base font-medium leading-relaxed focus:ring-4 focus:ring-primary/5 transition-all shadow-inner"
                  value={draft.toneCustomInstructions ?? ""}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, toneCustomInstructions: event.target.value || null }))
                  }
                  placeholder="e.g. Always emphasize our commitment to local sourcing and keep responses under 50 words..."
                />
              </div>

              <div className="space-y-5">
                <div className="flex items-center justify-between px-1">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                    Keyword Triggers
                  </Label>
                  <Badge className="bg-muted text-muted-foreground border-none rounded-full px-3 font-mono text-[10px]">
                    {draft.mentionKeywords.length} / 30 SLOTS
                  </Badge>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Input
                      className="h-12 rounded-2xl border-border/50 bg-background px-5 font-bold shadow-sm focus:ring-4 focus:ring-primary/5 transition-all"
                      value={keywordInput}
                      placeholder="Add trigger word..."
                      onChange={(event) => setKeywordInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault()
                          addKeyword()
                        }
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={addKeyword}
                    className="h-12 rounded-2xl px-8 font-black bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 transition-all"
                  >
                    Register
                  </Button>
                </div>

                {draft.mentionKeywords.length > 0 && (
                  <div className="flex flex-wrap gap-2.5 p-6 rounded-[24px] bg-muted/20 border border-border/50 shadow-inner">
                    {draft.mentionKeywords.map((keyword) => (
                      <Badge
                        key={keyword}
                        variant="secondary"
                        className="group flex items-center gap-2 rounded-full border-border/50 bg-background px-4 py-2 text-xs font-bold shadow-sm transition-all hover:border-primary/30"
                      >
                        <span className="text-primary/60">#</span>
                        {keyword}
                        <button
                          type="button"
                          onClick={() => removeKeyword(keyword)}
                          className="ml-1 rounded-full p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4 border-t border-border/50">
                <Button
                  disabled={saving}
                  onClick={() =>
                    submit({
                      tonePreset: draft.tonePreset,
                      toneCustomInstructions: draft.toneCustomInstructions,
                      mentionKeywords: draft.mentionKeywords,
                    })
                  }
                  className="h-12 rounded-2xl px-10 font-black bg-primary shadow-glow-primary hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] transition-all min-w-[160px]"
                >
                  {saving ? (
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  ) : null}
                  Update Brand Voice
                </Button>
              </div>
            </CardContent>
          </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
