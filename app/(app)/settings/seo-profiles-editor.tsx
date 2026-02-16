"use client"

import * as React from "react"
import { toast } from "sonner"
import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Save, Globe, Loader2, MapPin, Plus, X } from "@/components/icons"
import { SEO_PROFILE_LIMITS } from "@/lib/policy"
import { cn } from "@/lib/utils"

type KeywordBucket = "primaryKeywords" | "secondaryKeywords" | "geoTerms"
type DspyOverrideField = "programVersion" | "draftModel" | "verifyModel"
type DspyExperimentField = "id" | "trafficPercent" | DspyOverrideField

type EditorState = {
  primaryKeywords: string
  secondaryKeywords: string
  geoTerms: string
}

export type SeoLocationDspyExperimentPayload = {
  id: string
  trafficPercent: number
  programVersion?: string
  draftModel?: string
  verifyModel?: string
}

export type SeoLocationDspyConfigPayload = {
  programVersion?: string
  draftModel?: string
  verifyModel?: string
  experiments?: SeoLocationDspyExperimentPayload[]
}

export type SeoLocationProfilePayload = {
  locationId: string
  displayName: string
  primaryKeywords: string[]
  secondaryKeywords: string[]
  geoTerms: string[]
  dspyConfig?: SeoLocationDspyConfigPayload | null
}

type DspyExperimentDraft = {
  id: string
  trafficPercent: string
  programVersion: string
  draftModel: string
  verifyModel: string
}

type DspyConfigDraft = {
  programVersion: string
  draftModel: string
  verifyModel: string
  experiments: DspyExperimentDraft[]
}

type EditableSeoLocationProfile = Omit<SeoLocationProfilePayload, "dspyConfig"> & {
  dspyConfig: DspyConfigDraft
}

type DspyExperimentErrors = Partial<Record<DspyExperimentField, string>>

type DspyLocationErrors = {
  general?: string
  base: Partial<Record<DspyOverrideField, string>>
  experiments: DspyExperimentErrors[]
}

type SeoProfilesEditorProps = {
  initialProfiles: SeoLocationProfilePayload[]
  saving: boolean
  onSave: (profiles: SeoLocationProfilePayload[]) => Promise<void>
}

const DSPY_LIMITS = {
  identifierMax: 120,
  experimentIdMax: 80,
  experimentsMax: 20,
} as const

const SEO_EDITOR_CARD = "app-surface-shell rounded-[28px] border-border/55 bg-card/85 shadow-card"
const SEO_SECTION_LABEL = "app-field-label"
const SEO_COUNT_BADGE = "rounded-md bg-muted text-muted-foreground px-2 font-mono text-[9px]"
const SEO_INPUT = "h-9 rounded-xl border-border/50 bg-background shadow-sm focus-visible:ring-2 focus-visible:ring-primary/20"

const BUCKET_CONFIG: Record<
  KeywordBucket,
  { label: string; hint: string; max: number; placeholder: string }
> = {
  primaryKeywords: {
    label: "Primary Keywords",
    hint: "Main phrases your business should rank for.",
    max: SEO_PROFILE_LIMITS.PRIMARY_MAX,
    placeholder: "e.g. tikka masala",
  },
  secondaryKeywords: {
    label: "Secondary Keywords",
    hint: "Supporting terms that can appear naturally.",
    max: SEO_PROFILE_LIMITS.SECONDARY_MAX,
    placeholder: "e.g. family dinner",
  },
  geoTerms: {
    label: "Geo Terms",
    hint: "Local area modifiers for location relevance.",
    max: SEO_PROFILE_LIMITS.GEO_MAX,
    placeholder: "e.g. downtown austin",
  },
}

const DSPY_OVERRIDE_FIELD_CONFIG: Array<{
  key: DspyOverrideField
  label: string
  placeholder: string
}> = [
  {
    key: "programVersion",
    label: "Program Version",
    placeholder: "e.g. v3.2.1",
  },
  {
    key: "draftModel",
    label: "Draft Model",
    placeholder: "e.g. gemini-2.5-pro",
  },
  {
    key: "verifyModel",
    label: "Verify Model",
    placeholder: "e.g. gemini-2.5-flash",
  },
]

function normalizeKeyword(raw: string) {
  const value = raw.trim().toLowerCase()
  if (!value) return null
  if (value.length > SEO_PROFILE_LIMITS.KEYWORD_MAX_LENGTH) return null
  return value
}

function emptyInputState() {
  return {
    primaryKeywords: "",
    secondaryKeywords: "",
    geoTerms: "",
  } satisfies EditorState
}

function emptyExperimentDraft(): DspyExperimentDraft {
  return {
    id: "",
    trafficPercent: "",
    programVersion: "",
    draftModel: "",
    verifyModel: "",
  }
}

function toOptionalIdentifier(value: string) {
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function parseTrafficPercent(value: string): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.round(parsed * 100) / 100
}

function hasLocationErrors(error: DspyLocationErrors) {
  if (error.general) return true
  if (Object.keys(error.base).length > 0) return true
  return error.experiments.some((row) => Object.keys(row).length > 0)
}

function toEditableProfile(profile: SeoLocationProfilePayload): EditableSeoLocationProfile {
  const dspyConfig = profile.dspyConfig ?? null
  return {
    locationId: profile.locationId,
    displayName: profile.displayName,
    primaryKeywords: [...profile.primaryKeywords],
    secondaryKeywords: [...profile.secondaryKeywords],
    geoTerms: [...profile.geoTerms],
    dspyConfig: {
      programVersion: dspyConfig?.programVersion ?? "",
      draftModel: dspyConfig?.draftModel ?? "",
      verifyModel: dspyConfig?.verifyModel ?? "",
      experiments: (dspyConfig?.experiments ?? []).map((experiment) => ({
        id: experiment.id,
        trafficPercent: String(experiment.trafficPercent),
        programVersion: experiment.programVersion ?? "",
        draftModel: experiment.draftModel ?? "",
        verifyModel: experiment.verifyModel ?? "",
      })),
    },
  }
}

function validateAndBuildPayload(
  profiles: EditableSeoLocationProfile[],
): { payload: SeoLocationProfilePayload[]; errors: Record<string, DspyLocationErrors> } {
  const errors: Record<string, DspyLocationErrors> = {}

  const payload: SeoLocationProfilePayload[] = profiles.map((profile) => {
    const locationErrors: DspyLocationErrors = {
      base: {},
      experiments: profile.dspyConfig.experiments.map(() => ({})),
    }

    const baseConfig: SeoLocationDspyConfigPayload = {}

    for (const field of DSPY_OVERRIDE_FIELD_CONFIG) {
      const raw = profile.dspyConfig[field.key]
      const normalized = toOptionalIdentifier(raw)
      if (normalized && normalized.length > DSPY_LIMITS.identifierMax) {
        locationErrors.base[field.key] = `Maximum ${DSPY_LIMITS.identifierMax} characters.`
        continue
      }
      if (normalized) {
        baseConfig[field.key] = normalized
      }
    }

    const seenExperimentIds = new Set<string>()
    const experimentsPayload: SeoLocationDspyExperimentPayload[] = []
    let totalTrafficPercent = 0

    if (profile.dspyConfig.experiments.length > DSPY_LIMITS.experimentsMax) {
      locationErrors.general = `Maximum ${DSPY_LIMITS.experimentsMax} experiments per location.`
    }

    profile.dspyConfig.experiments.forEach((experiment, index) => {
      const rowErrors = locationErrors.experiments[index] ?? {}
      const id = experiment.id.trim()
      if (!id) {
        rowErrors.id = "Experiment id is required."
      } else if (id.length > DSPY_LIMITS.experimentIdMax) {
        rowErrors.id = `Maximum ${DSPY_LIMITS.experimentIdMax} characters.`
      } else if (seenExperimentIds.has(id)) {
        rowErrors.id = "Experiment id must be unique."
      } else {
        seenExperimentIds.add(id)
      }

      const trafficRaw = experiment.trafficPercent.trim()
      if (!trafficRaw) {
        rowErrors.trafficPercent = "Traffic percent is required."
      }
      const trafficPercent = parseTrafficPercent(trafficRaw)
      if (trafficPercent == null || trafficPercent < 0 || trafficPercent > 100) {
        rowErrors.trafficPercent = "Enter a number between 0 and 100."
      }

      const normalizedProgramVersion = toOptionalIdentifier(experiment.programVersion)
      const normalizedDraftModel = toOptionalIdentifier(experiment.draftModel)
      const normalizedVerifyModel = toOptionalIdentifier(experiment.verifyModel)

      if (normalizedProgramVersion && normalizedProgramVersion.length > DSPY_LIMITS.identifierMax) {
        rowErrors.programVersion = `Maximum ${DSPY_LIMITS.identifierMax} characters.`
      }
      if (normalizedDraftModel && normalizedDraftModel.length > DSPY_LIMITS.identifierMax) {
        rowErrors.draftModel = `Maximum ${DSPY_LIMITS.identifierMax} characters.`
      }
      if (normalizedVerifyModel && normalizedVerifyModel.length > DSPY_LIMITS.identifierMax) {
        rowErrors.verifyModel = `Maximum ${DSPY_LIMITS.identifierMax} characters.`
      }

      locationErrors.experiments[index] = rowErrors

      if (Object.keys(rowErrors).length > 0 || trafficPercent == null) {
        return
      }

      totalTrafficPercent += trafficPercent
      experimentsPayload.push({
        id,
        trafficPercent,
        ...(normalizedProgramVersion ? { programVersion: normalizedProgramVersion } : {}),
        ...(normalizedDraftModel ? { draftModel: normalizedDraftModel } : {}),
        ...(normalizedVerifyModel ? { verifyModel: normalizedVerifyModel } : {}),
      })
    })

    if (totalTrafficPercent > 100) {
      locationErrors.general = "Combined experiment traffic must be 100% or less."
    }

    if (hasLocationErrors(locationErrors)) {
      errors[profile.locationId] = locationErrors
    }

    const hasBaseOverrides = Object.keys(baseConfig).length > 0
    const dspyConfig = hasBaseOverrides || experimentsPayload.length > 0
      ? {
          ...baseConfig,
          ...(experimentsPayload.length > 0 ? { experiments: experimentsPayload } : {}),
        }
      : null

    return {
      locationId: profile.locationId,
      displayName: profile.displayName,
      primaryKeywords: profile.primaryKeywords,
      secondaryKeywords: profile.secondaryKeywords,
      geoTerms: profile.geoTerms,
      dspyConfig,
    }
  })

  return { payload, errors }
}

export function SeoProfilesEditor({ initialProfiles, saving, onSave }: SeoProfilesEditorProps) {
  const [profiles, setProfiles] = React.useState<EditableSeoLocationProfile[]>(
    () => initialProfiles.map(toEditableProfile),
  )
  const [inputs, setInputs] = React.useState<Record<string, EditorState>>({})
  const [dspyErrors, setDspyErrors] = React.useState<Record<string, DspyLocationErrors>>({})

  React.useEffect(() => {
    setProfiles(initialProfiles.map(toEditableProfile))
    setDspyErrors({})
  }, [initialProfiles])

  const clearLocationErrors = (locationId: string) => {
    setDspyErrors((previous) => {
      if (!previous[locationId]) return previous
      const next = { ...previous }
      delete next[locationId]
      return next
    })
  }

  const updateProfile = (locationId: string, mutate: (profile: EditableSeoLocationProfile) => EditableSeoLocationProfile) => {
    setProfiles((previous) => previous.map((profile) => (profile.locationId === locationId ? mutate(profile) : profile)))
    clearLocationErrors(locationId)
  }

  const setInputValue = (locationId: string, bucket: KeywordBucket, value: string) => {
    setInputs((previous) => ({
      ...previous,
      [locationId]: {
        ...(previous[locationId] ?? emptyInputState()),
        [bucket]: value,
      },
    }))
  }

  const addKeyword = (locationId: string, bucket: KeywordBucket) => {
    const nextValue = normalizeKeyword(inputs[locationId]?.[bucket] ?? "")
    if (!nextValue) {
      toast.error(`Keyword must be 1-${SEO_PROFILE_LIMITS.KEYWORD_MAX_LENGTH} characters.`)
      return
    }

    const limit = BUCKET_CONFIG[bucket].max
    let duplicate = false
    let overLimit = false
    setProfiles((previous) =>
      previous.map((profile) => {
        if (profile.locationId !== locationId) return profile
        const bucketValues = profile[bucket]
        if (bucketValues.includes(nextValue)) {
          duplicate = true
          return profile
        }
        if (bucketValues.length >= limit) {
          overLimit = true
          return profile
        }
        return { ...profile, [bucket]: [...bucketValues, nextValue] }
      }),
    )

    if (duplicate) {
      setInputValue(locationId, bucket, "")
      return
    }
    if (overLimit) {
      toast.error(`Maximum ${limit} keywords for ${BUCKET_CONFIG[bucket].label.toLowerCase()}.`)
      return
    }
    setInputValue(locationId, bucket, "")
  }

  const removeKeyword = (locationId: string, bucket: KeywordBucket, keyword: string) => {
    setProfiles((previous) =>
      previous.map((profile) => {
        if (profile.locationId !== locationId) return profile
        return {
          ...profile,
          [bucket]: profile[bucket].filter((value) => value !== keyword),
        }
      }),
    )
  }

  const setDspyOverrideField = (locationId: string, field: DspyOverrideField, value: string) => {
    updateProfile(locationId, (profile) => ({
      ...profile,
      dspyConfig: {
        ...profile.dspyConfig,
        [field]: value,
      },
    }))
  }

  const addDspyExperiment = (locationId: string) => {
    const current = profiles.find((profile) => profile.locationId === locationId)
    if (!current) return

    if (current.dspyConfig.experiments.length >= DSPY_LIMITS.experimentsMax) {
      toast.error(`Maximum ${DSPY_LIMITS.experimentsMax} experiments per location.`)
      return
    }

    updateProfile(locationId, (profile) => ({
      ...profile,
      dspyConfig: {
        ...profile.dspyConfig,
        experiments: [...profile.dspyConfig.experiments, emptyExperimentDraft()],
      },
    }))
  }

  const removeDspyExperiment = (locationId: string, index: number) => {
    updateProfile(locationId, (profile) => ({
      ...profile,
      dspyConfig: {
        ...profile.dspyConfig,
        experiments: profile.dspyConfig.experiments.filter((_, itemIndex) => itemIndex !== index),
      },
    }))
  }

  const setDspyExperimentField = (
    locationId: string,
    index: number,
    field: DspyExperimentField,
    value: string,
  ) => {
    updateProfile(locationId, (profile) => ({
      ...profile,
      dspyConfig: {
        ...profile.dspyConfig,
        experiments: profile.dspyConfig.experiments.map((experiment, itemIndex) => {
          if (itemIndex !== index) return experiment
          return { ...experiment, [field]: value }
        }),
      },
    }))
  }

  const handleSave = () => {
    const { payload, errors } = validateAndBuildPayload(profiles)
    if (Object.keys(errors).length > 0) {
      setDspyErrors(errors)
      toast.error("Fix DSPy override validation errors before saving.")
      return
    }

    setDspyErrors({})
    void onSave(payload)
  }

  return (
    <Card className={SEO_EDITOR_CARD}>
      <CardContent className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="space-y-1">
            <div className="app-section-title">Location SEO Profiles</div>
            <p className="text-xs text-muted-foreground leading-relaxed font-medium max-w-xl">
              DSPy will use these keywords to produce replies that are locally relevant and SEO aligned without
              keyword stuffing.
            </p>
          </div>
          <Badge variant="secondary" className={SEO_COUNT_BADGE}>
            {profiles.length} location{profiles.length === 1 ? "" : "s"}
          </Badge>
        </div>

        {profiles.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground font-medium">No enabled locations available.</p>
            <p className="text-xs text-muted-foreground mt-1">Enable locations first to configure SEO profiles.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {profiles.map((profile) => {
              const locationErrors = dspyErrors[profile.locationId]

              return (
                <Card key={profile.locationId} className="app-pane-card rounded-2xl border-border/55 bg-muted/30 shadow-sm">
                  <CardContent className="space-y-4 p-3 md:p-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-7 w-7 rounded-lg border border-border bg-card flex items-center justify-center shrink-0">
                      <MapPin className="size-3.5 text-muted-foreground" />
                    </div>
                    <div className="text-sm font-semibold text-foreground truncate">{profile.displayName}</div>
                  </div>

                  <KeywordBucketEditor
                    bucket="primaryKeywords"
                    values={profile.primaryKeywords}
                    inputValue={inputs[profile.locationId]?.primaryKeywords ?? ""}
                    onInputChange={(value) => setInputValue(profile.locationId, "primaryKeywords", value)}
                    onAdd={() => addKeyword(profile.locationId, "primaryKeywords")}
                    onRemove={(keyword) => removeKeyword(profile.locationId, "primaryKeywords", keyword)}
                  />
                  <Separator className="bg-border" />
                  <KeywordBucketEditor
                    bucket="secondaryKeywords"
                    values={profile.secondaryKeywords}
                    inputValue={inputs[profile.locationId]?.secondaryKeywords ?? ""}
                    onInputChange={(value) => setInputValue(profile.locationId, "secondaryKeywords", value)}
                    onAdd={() => addKeyword(profile.locationId, "secondaryKeywords")}
                    onRemove={(keyword) => removeKeyword(profile.locationId, "secondaryKeywords", keyword)}
                  />
                  <Separator className="bg-border" />
                  <KeywordBucketEditor
                    bucket="geoTerms"
                    values={profile.geoTerms}
                    inputValue={inputs[profile.locationId]?.geoTerms ?? ""}
                    onInputChange={(value) => setInputValue(profile.locationId, "geoTerms", value)}
                    onAdd={() => addKeyword(profile.locationId, "geoTerms")}
                    onRemove={(keyword) => removeKeyword(profile.locationId, "geoTerms", keyword)}
                  />
                  <Separator className="bg-border" />
                  <DspyOverridesEditor
                    draft={profile.dspyConfig}
                    errors={locationErrors}
                    onOverrideChange={(field, value) => setDspyOverrideField(profile.locationId, field, value)}
                    onAddExperiment={() => addDspyExperiment(profile.locationId)}
                    onRemoveExperiment={(index) => removeDspyExperiment(profile.locationId, index)}
                    onExperimentChange={(index, field, value) =>
                      setDspyExperimentField(profile.locationId, index, field, value)
                    }
                  />
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            className="app-action-primary w-full min-w-[120px] gap-2 rounded-xl bg-primary text-xs text-primary-foreground shadow-elevated hover:bg-primary/90 sm:w-auto"
            disabled={saving || profiles.length === 0}
            onClick={handleSave}
          >
            {saving ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                <Loader2 className="size-3.5" />
              </motion.div>
            ) : <Save className="size-3.5" />}
            {saving ? "Saving…" : "Save SEO Profiles"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

type KeywordBucketEditorProps = {
  bucket: KeywordBucket
  values: string[]
  inputValue: string
  onInputChange: (value: string) => void
  onAdd: () => void
  onRemove: (keyword: string) => void
}

function KeywordBucketEditor({
  bucket,
  values,
  inputValue,
  onInputChange,
  onAdd,
  onRemove,
}: KeywordBucketEditorProps) {
  const config = BUCKET_CONFIG[bucket]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-1">
          <Label className={SEO_SECTION_LABEL}>{config.label}</Label>
          <p className="text-xs text-muted-foreground font-medium">{config.hint}</p>
        </div>
        <Badge variant="secondary" className={SEO_COUNT_BADGE}>
          {values.length}/{config.max}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <Input
          className={cn(SEO_INPUT, values.length >= config.max && "opacity-50")}
          value={inputValue}
          placeholder={config.placeholder}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return
            event.preventDefault()
            onAdd()
          }}
          disabled={values.length >= config.max}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="app-action-secondary h-9 shrink-0 rounded-xl border-border text-xs font-semibold"
          onClick={onAdd}
          disabled={values.length >= config.max}
        >
          <Plus className="size-3" />
        </Button>
      </div>

      {values.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <Badge
              key={value}
              variant="secondary"
              className="app-action-secondary h-7 gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs text-muted-foreground"
            >
              <Globe className="size-3" />
              {value}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground rounded-sm p-0.5 transition-colors h-4 w-4"
                onClick={() => onRemove(value)}
                aria-label={`Remove ${value}`}
              >
                <X className="size-3" />
              </Button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  )
}

type DspyOverridesEditorProps = {
  draft: DspyConfigDraft
  errors?: DspyLocationErrors
  onOverrideChange: (field: DspyOverrideField, value: string) => void
  onAddExperiment: () => void
  onRemoveExperiment: (index: number) => void
  onExperimentChange: (index: number, field: DspyExperimentField, value: string) => void
}

function DspyOverridesEditor({
  draft,
  errors,
  onOverrideChange,
  onAddExperiment,
  onRemoveExperiment,
  onExperimentChange,
}: DspyOverridesEditorProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <Label className={SEO_SECTION_LABEL}>DSPy Overrides</Label>
          <p className="text-xs text-muted-foreground font-medium">
            Optional model and program overrides scoped to this location.
          </p>
        </div>
        <Badge variant="secondary" className={SEO_COUNT_BADGE}>
          {draft.experiments.length}/{DSPY_LIMITS.experimentsMax} exp
        </Badge>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        {DSPY_OVERRIDE_FIELD_CONFIG.map((field) => (
          <div key={field.key} className="space-y-1">
            <Label className="app-field-label">{field.label}</Label>
            <Input
              value={draft[field.key]}
              placeholder={field.placeholder}
              className={cn("h-8 rounded-lg text-xs border-border/50 bg-background shadow-sm focus-visible:ring-2 focus-visible:ring-primary/20", errors?.base[field.key] && "border-destructive")}
              onChange={(event) => onOverrideChange(field.key, event.target.value)}
              aria-invalid={Boolean(errors?.base[field.key])}
            />
            {errors?.base[field.key] ? (
              <p className="text-[10px] font-medium text-destructive">{errors.base[field.key]}</p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="app-field-label">Experiments</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="app-action-secondary h-7 rounded-lg border-border/50 text-[10px] font-semibold"
            onClick={onAddExperiment}
            disabled={draft.experiments.length >= DSPY_LIMITS.experimentsMax}
          >
            <Plus className="size-3" />
            Add
          </Button>
        </div>

        {errors?.general ? (
          <p className="text-[10px] font-medium text-destructive">{errors.general}</p>
        ) : null}

        {draft.experiments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-3 text-[11px] font-medium text-muted-foreground">
              No experiments configured.
            </div>
          ) : (
            <div className="space-y-2">
              {draft.experiments.map((experiment, index) => {
              const rowErrors = errors?.experiments[index]

              return (
                  <div key={`${index}-${experiment.id || "new"}`} className="app-pane-card rounded-xl border-border/60 bg-background p-2.5 space-y-2">
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_128px_auto]">
                    <div className="space-y-1">
                      <Label className="app-field-label">Experiment Id</Label>
                      <Input
                        value={experiment.id}
                        placeholder="e.g. lunch-semantic-a"
                        className={cn("h-8 rounded-lg text-xs border-border/50 bg-background shadow-sm focus-visible:ring-2 focus-visible:ring-primary/20", rowErrors?.id && "border-destructive")}
                        onChange={(event) => onExperimentChange(index, "id", event.target.value)}
                        aria-invalid={Boolean(rowErrors?.id)}
                      />
                      {rowErrors?.id ? (
                        <p className="text-[10px] font-medium text-destructive">{rowErrors.id}</p>
                      ) : null}
                    </div>

                    <div className="space-y-1">
                      <Label className="app-field-label">Traffic %</Label>
                      <Input
                        value={experiment.trafficPercent}
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="0"
                        className={cn("h-8 rounded-lg text-xs border-border/50 bg-background shadow-sm focus-visible:ring-2 focus-visible:ring-primary/20", rowErrors?.trafficPercent && "border-destructive")}
                        onChange={(event) => onExperimentChange(index, "trafficPercent", event.target.value)}
                        aria-invalid={Boolean(rowErrors?.trafficPercent)}
                      />
                      {rowErrors?.trafficPercent ? (
                        <p className="text-[10px] font-medium text-destructive">{rowErrors.trafficPercent}</p>
                      ) : null}
                    </div>

                    <div className="flex items-end justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                        onClick={() => onRemoveExperiment(index)}
                        aria-label={`Remove experiment ${index + 1}`}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-2 md:grid-cols-3">
                    {DSPY_OVERRIDE_FIELD_CONFIG.map((field) => (
                      <div key={`${index}-${field.key}`} className="space-y-1">
                        <Label className="app-field-label">
                          {field.label}
                        </Label>
                        <Input
                          value={experiment[field.key]}
                          placeholder={`Optional ${field.label.toLowerCase()}`}
                          className={cn("h-8 rounded-lg text-xs border-border/50 bg-background shadow-sm focus-visible:ring-2 focus-visible:ring-primary/20", rowErrors?.[field.key] && "border-destructive")}
                          onChange={(event) => onExperimentChange(index, field.key, event.target.value)}
                          aria-invalid={Boolean(rowErrors?.[field.key])}
                        />
                        {rowErrors?.[field.key] ? (
                          <p className="text-[10px] font-medium text-destructive">{rowErrors[field.key]}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
