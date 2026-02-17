"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { withIdempotencyHeader } from "@/lib/api/client-idempotency"
import { INBOX_PAGE_THEME_CLASSES } from "@/lib/design-system/inbox-theme"
import { cn } from "@/lib/utils"
import {
  CheckCircle2,
  Globe,
  Loader2,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  StarFilled,
  X,
  Zap,
} from "@/components/icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  SeoProfilesEditor,
  type SeoLocationDspyConfigPayload,
  type SeoLocationDspyExperimentPayload,
  type SeoLocationProfilePayload,
} from "@/app/(app)/settings/seo-profiles-editor"

type DspyExperimentInput = {
  id?: string | null
  trafficPercent?: number | null
  programVersion?: string | null
  draftModel?: string | null
  verifyModel?: string | null
}

type DspyConfigInput = {
  programVersion?: string | null
  draftModel?: string | null
  verifyModel?: string | null
  experiments?: DspyExperimentInput[] | null
}

type SettingsShape = {
  tonePreset: string
  toneCustomInstructions: string | null
  autoDraftEnabled: boolean
  autoDraftForRatings: number[]
  bulkApproveEnabledForFiveStar: boolean
  mentionKeywords: string[]
  dspyConfig: SeoLocationDspyConfigPayload | null
}

type SettingsInput = Omit<SettingsShape, "dspyConfig"> & {
  dspyConfig?: DspyConfigInput | null
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
    dspyConfig?: DspyConfigInput | null
  }>
  settings: SettingsInput
  showBulkApprove?: boolean
}

type DspyTextField = "programVersion" | "draftModel" | "verifyModel"

type SeoLocationProfileWithDspy = SeoLocationProfilePayload & {
  dspyConfig?: DspyConfigInput | null
}

const TONE_PRESETS = ["friendly", "professional", "empathetic", "concise", "upbeat"] as const
const SETTINGS_SURFACE_CARD = "app-surface-shell overflow-hidden rounded-[30px]"
const SETTINGS_CARD_HEADER = "border-b border-shell-foreground/[0.05] bg-shell-foreground/[0.02] pb-6"
const SETTINGS_CARD_BODY = "space-y-8 p-7 md:p-8"
const SETTINGS_FIELD_LABEL = "text-[10px] font-black uppercase tracking-[0.16em] text-shell-foreground/40 px-1"
const SETTINGS_INPUT = "h-11 rounded-2xl border-shell-foreground/[0.08] bg-shell-foreground/[0.03] px-4 font-medium text-shell-foreground placeholder:text-shell-foreground/30 shadow-sm focus-visible:ring-2 focus-visible:ring-brand/20"
const SETTINGS_PRIMARY_ACTION = "h-12 w-full rounded-2xl bg-brand px-10 font-black text-brand-foreground shadow-lg shadow-brand/20 hover:bg-brand-soft sm:w-auto sm:min-w-[172px]"
const SETTINGS_SECONDARY_PANEL = "backdrop-blur-xl bg-shell-foreground/[0.02] border border-shell-foreground/[0.05] rounded-[24px] p-6"

function isValidKeyword(raw: string) {
  const value = raw.trim().toLowerCase()
  if (value.length < 1 || value.length > 32) return null
  return value
}

function normalizeIdentifier(raw: string | null | undefined) {
  if (typeof raw !== "string") return undefined
  const value = raw.trim()
  return value.length > 0 ? value : undefined
}

function normalizeExperiment(experiment: DspyExperimentInput): SeoLocationDspyExperimentPayload | null {
  const id = typeof experiment.id === "string" ? experiment.id.trim() : ""
  if (!id) return null

  const trafficPercent = Number.isFinite(experiment.trafficPercent)
    ? Math.max(0, Math.min(100, Math.round((experiment.trafficPercent ?? 0) * 100) / 100))
    : 0

  const programVersion = normalizeIdentifier(experiment.programVersion)
  const draftModel = normalizeIdentifier(experiment.draftModel)
  const verifyModel = normalizeIdentifier(experiment.verifyModel)

  return {
    id,
    trafficPercent,
    ...(programVersion ? { programVersion } : {}),
    ...(draftModel ? { draftModel } : {}),
    ...(verifyModel ? { verifyModel } : {}),
  }
}

function normalizeDspyConfig(input: DspyConfigInput | null | undefined): SeoLocationDspyConfigPayload | null {
  if (!input) return null

  const programVersion = normalizeIdentifier(input.programVersion)
  const draftModel = normalizeIdentifier(input.draftModel)
  const verifyModel = normalizeIdentifier(input.verifyModel)
  const experiments = Array.isArray(input.experiments)
    ? input.experiments
        .map(normalizeExperiment)
        .filter((experiment): experiment is SeoLocationDspyExperimentPayload => Boolean(experiment))
    : []

  if (!programVersion && !draftModel && !verifyModel && experiments.length === 0) {
    return null
  }

  return {
    ...(programVersion ? { programVersion } : {}),
    ...(draftModel ? { draftModel } : {}),
    ...(verifyModel ? { verifyModel } : {}),
    ...(experiments.length > 0 ? { experiments } : {}),
  }
}

function hasDspyConfigContent(config: DspyConfigInput | null | undefined) {
  if (!config) return false
  if ((config.programVersion ?? "").trim().length > 0) return true
  if ((config.draftModel ?? "").trim().length > 0) return true
  if ((config.verifyModel ?? "").trim().length > 0) return true
  return (config.experiments?.length ?? 0) > 0
}

function extractSeoProfileDspyConfig(profile: SeoLocationProfilePayload): SeoLocationDspyConfigPayload | null | undefined {
  if (!Object.hasOwn(profile, "dspyConfig")) {
    return undefined
  }

  return normalizeDspyConfig((profile as SeoLocationProfileWithDspy).dspyConfig)
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
  const [draft, setDraft] = React.useState<SettingsShape>(() => ({
    ...settings,
    dspyConfig: normalizeDspyConfig(settings.dspyConfig),
  }))
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
          locations: profiles.map((profile) => {
            const dspyConfig = extractSeoProfileDspyConfig(profile)
            return {
              locationId: profile.locationId,
              primaryKeywords: profile.primaryKeywords,
              secondaryKeywords: profile.secondaryKeywords,
              geoTerms: profile.geoTerms,
              ...(dspyConfig === undefined ? {} : { dspyConfig }),
            }
          }),
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

  const updateOrgDspyField = (field: DspyTextField, value: string) => {
    setDraft((previous) => {
      const nextConfig: SeoLocationDspyConfigPayload = { ...(previous.dspyConfig ?? {}) }

      if (field === "programVersion") nextConfig.programVersion = value
      if (field === "draftModel") nextConfig.draftModel = value
      if (field === "verifyModel") nextConfig.verifyModel = value

      return {
        ...previous,
        dspyConfig: hasDspyConfigContent(nextConfig) ? nextConfig : null,
      }
    })
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
    <div className={INBOX_PAGE_THEME_CLASSES.page}>
      <div className={INBOX_PAGE_THEME_CLASSES.hero}>
        <div className={INBOX_PAGE_THEME_CLASSES.heroLead}>
          <div className={INBOX_PAGE_THEME_CLASSES.heroIcon}>
            <Settings className="size-7" />
          </div>
          <div className="space-y-1">
            <h1 className={INBOX_PAGE_THEME_CLASSES.heroTitle}>Command Center</h1>
            <p className={INBOX_PAGE_THEME_CLASSES.heroKicker}>Configure intelligence & automation</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <TabsList className={INBOX_PAGE_THEME_CLASSES.tabList}>
          {[
            { value: "general", label: "General", icon: Globe },
            { value: "automation", label: "Automation", icon: Zap },
            { value: "seo", label: "SEO Intelligence", icon: Sparkles },
            { value: "tone", label: "AI Tone", icon: ShieldCheck },
          ].map((tab) => (
            <TabsTrigger 
              key={tab.value}
              value={tab.value} 
              className={INBOX_PAGE_THEME_CLASSES.tabTrigger}
            >
              <tab.icon className="mr-2 h-4 w-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          <Card className={SETTINGS_SURFACE_CARD}>
            <CardHeader className={SETTINGS_CARD_HEADER}>
              <CardTitle className="flex items-center gap-3 text-lg font-black tracking-tight">
                <Globe className="h-5 w-5 text-primary" />
                Organization Identity
              </CardTitle>
            </CardHeader>
            <CardContent className={SETTINGS_CARD_BODY}>
              <div className="space-y-3">
                <Label className={SETTINGS_FIELD_LABEL}>
                  Legal Name
                </Label>
                <div className="app-pane-card flex items-center gap-4 rounded-[20px] bg-muted/30 p-5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-bold text-foreground">{orgName}</p>
                    <p className="text-xs font-medium text-muted-foreground">Active organizational profile</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Label className={SETTINGS_FIELD_LABEL}>
                  Google Business Connectivity
                </Label>
                {googleConnection ? (
                  <div className="app-pane-card flex flex-wrap items-center gap-5 rounded-[24px] p-6 transition-all hover:shadow-card">
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
                          ? "bg-success/10 text-success border-none"
                          : "bg-destructive/10 text-destructive border-none",
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
                  <div className="flex flex-col items-center justify-center rounded-[28px] border-2 border-dashed border-shell-foreground/10 bg-muted/20 p-10 text-center transition-all hover:bg-muted/30">
                    <div className="h-16 w-16 rounded-[24px] bg-background shadow-card border border-shell-foreground/10 flex items-center justify-center mb-6">
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
          <Card className={SETTINGS_SURFACE_CARD}>
            <CardHeader className={SETTINGS_CARD_HEADER}>
              <CardTitle className="flex items-center gap-3 text-lg font-black tracking-tight">
                <Zap className="h-5 w-5 text-primary" />
                Workflow Automation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-9 p-7 md:p-8">
              <div className={cn(SETTINGS_SECONDARY_PANEL, "border-primary/10 bg-primary/[0.03] sm:flex-row sm:items-center sm:justify-between", "flex flex-col gap-6")}>
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
                <Label className={SETTINGS_FIELD_LABEL}>
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
                    const StarIcon = isActive ? StarFilled : Star
                    return (
                      <ToggleGroupItem
                        key={rating}
                        value={String(rating)}
                        className={cn(
                          "inline-flex h-12 w-20 items-center justify-center gap-2 rounded-2xl border-2 font-black transition-all",
                          isActive
                            ? "border-primary/30 bg-primary/10 text-primary shadow-sm"
                            : "border-shell-foreground/10 bg-background text-muted-foreground hover:bg-muted/50",
                        )}
                      >
                        {rating}
                        <StarIcon className="h-4 w-4" />
                      </ToggleGroupItem>
                    )
                  })}
                </ToggleGroup>
              </div>

              {showBulkApprove && (
                <div className={cn(SETTINGS_SECONDARY_PANEL, "border-success/15 bg-success/10 sm:flex-row sm:items-center sm:justify-between", "flex flex-col gap-6")}>
                  <div className="space-y-1.5">
                    <Label className="text-base font-bold text-foreground">Instant Bulk Publishing</Label>
                    <p className="text-sm font-medium text-muted-foreground">Enable one-click batch posting for verified 5-star responses.</p>
                  </div>
                  <Switch
                    checked={draft.bulkApproveEnabledForFiveStar}
                    onCheckedChange={(value) =>
                      setDraft((prev) => ({ ...prev, bulkApproveEnabledForFiveStar: value }))
                    }
                    className="data-[state=checked]:bg-success shadow-sm"
                  />
                </div>
              )}

              <div className={SETTINGS_SECONDARY_PANEL}>
                <div className="space-y-1.5">
                  <Label className="text-base font-bold text-foreground">DSPy Runtime Defaults</Label>
                  <p className="text-sm font-medium text-muted-foreground">
                    Set organization-level DSPy defaults for drafting and verification. Location SEO profiles can override these values.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label className="app-field-label">
                      Program Version
                    </Label>
                    <Input
                      value={draft.dspyConfig?.programVersion ?? ""}
                      onChange={(event) => updateOrgDspyField("programVersion", event.target.value)}
                      placeholder="e.g. reviews-v3"
                      className={SETTINGS_INPUT}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="app-field-label">
                      Draft Model
                    </Label>
                    <Input
                      value={draft.dspyConfig?.draftModel ?? ""}
                      onChange={(event) => updateOrgDspyField("draftModel", event.target.value)}
                      placeholder="e.g. gpt-4.1-mini"
                      className={SETTINGS_INPUT}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="app-field-label">
                      Verify Model
                    </Label>
                    <Input
                      value={draft.dspyConfig?.verifyModel ?? ""}
                      onChange={(event) => updateOrgDspyField("verifyModel", event.target.value)}
                      placeholder="e.g. gpt-4.1"
                      className={SETTINGS_INPUT}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end border-t border-shell-foreground/10 pt-4">
                <Button
                  disabled={saving}
                  onClick={() =>
                    submit({
                      autoDraftEnabled: draft.autoDraftEnabled,
                      autoDraftForRatings: draft.autoDraftForRatings,
                      ...(showBulkApprove && {
                        bulkApproveEnabledForFiveStar: draft.bulkApproveEnabledForFiveStar,
                      }),
                      dspyConfig: normalizeDspyConfig(draft.dspyConfig),
                    })
                  }
                  className={SETTINGS_PRIMARY_ACTION}
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
              dspyConfig: normalizeDspyConfig(location.dspyConfig),
            }))}
            saving={savingSeo}
            onSave={saveSeoProfiles}
          />
          </div>
        </TabsContent>

        <TabsContent value="tone" className="space-y-6">
          <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          <Card className={SETTINGS_SURFACE_CARD}>
            <CardHeader className={SETTINGS_CARD_HEADER}>
              <CardTitle className="flex items-center gap-3 text-lg font-black tracking-tight">
                <ShieldCheck className="h-5 w-5 text-primary" />
                AI Voice & Personality
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-9 p-7 md:p-8">
              <div className="space-y-3">
                <Label className={SETTINGS_FIELD_LABEL}>
                  Active Intelligence Model
                </Label>
                <div className="app-pane-card flex flex-col items-start gap-4 rounded-[20px] bg-primary/[0.03] p-5 sm:flex-row sm:items-center">
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
                <Label className={SETTINGS_FIELD_LABEL}>
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
                            : "border-shell-foreground/10 bg-background text-muted-foreground hover:bg-muted/50",
                        )}
                      >
                        {tone}
                      </ToggleGroupItem>
                    )
                  })}
                </ToggleGroup>
              </div>

              <div className="space-y-3">
                <Label className={SETTINGS_FIELD_LABEL}>
                  Custom Brand Directives
                </Label>
                <Textarea
                  className="min-h-[140px] resize-none rounded-[24px] border-shell-foreground/10 bg-muted/25 p-6 text-base font-medium leading-relaxed transition-all shadow-inner focus-visible:ring-2 focus-visible:ring-primary/20"
                  value={draft.toneCustomInstructions ?? ""}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, toneCustomInstructions: event.target.value || null }))
                  }
                  placeholder="e.g. Always emphasize our commitment to local sourcing and keep responses under 50 words..."
                />
              </div>

              <div className="space-y-5">
                <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                    Keyword Triggers
                  </Label>
                  <Badge className="bg-muted text-muted-foreground border-none rounded-full px-3 font-mono text-[10px]">
                    {draft.mentionKeywords.length} / 30 SLOTS
                  </Badge>
                </div>
                
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Input
                      className="h-12 rounded-2xl border-shell-foreground/10 bg-background px-5 font-bold shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
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
                      className="app-action-secondary h-12 w-full rounded-2xl bg-secondary px-8 font-black text-secondary-foreground shadow-sm hover:bg-secondary/80 sm:w-auto"
                    >
                    Register
                  </Button>
                </div>

                {draft.mentionKeywords.length > 0 && (
                  <div className="app-pane-card flex flex-wrap gap-2.5 rounded-[24px] bg-muted/25 p-6">
                    {draft.mentionKeywords.map((keyword) => (
                      <Badge
                        key={keyword}
                        variant="secondary"
                        className="group flex items-center gap-2 rounded-full border-shell-foreground/10 bg-background px-4 py-2 text-xs font-bold shadow-sm transition-all hover:border-primary/30"
                      >
                        <span className="text-primary/60">#</span>
                        {keyword}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeKeyword(keyword)}
                          className="ml-1 h-5 w-5 rounded-full p-0 text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end border-t border-shell-foreground/10 pt-4">
                <Button
                  disabled={saving}
                  onClick={() =>
                    submit({
                      tonePreset: draft.tonePreset,
                      toneCustomInstructions: draft.toneCustomInstructions,
                      mentionKeywords: draft.mentionKeywords,
                    })
                  }
                  className={SETTINGS_PRIMARY_ACTION}
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
