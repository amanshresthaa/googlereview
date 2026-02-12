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

type EditorState = {
  primaryKeywords: string
  secondaryKeywords: string
  geoTerms: string
}

export type SeoLocationProfilePayload = {
  locationId: string
  displayName: string
  primaryKeywords: string[]
  secondaryKeywords: string[]
  geoTerms: string[]
}

type SeoProfilesEditorProps = {
  initialProfiles: SeoLocationProfilePayload[]
  saving: boolean
  onSave: (profiles: SeoLocationProfilePayload[]) => Promise<void>
}

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

export function SeoProfilesEditor({ initialProfiles, saving, onSave }: SeoProfilesEditorProps) {
  const [profiles, setProfiles] = React.useState<SeoLocationProfilePayload[]>(initialProfiles)
  const [inputs, setInputs] = React.useState<Record<string, EditorState>>({})

  React.useEffect(() => {
    setProfiles(initialProfiles)
  }, [initialProfiles])

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

  return (
    <Card className="rounded-2xl border-border bg-card shadow-card">
      <CardContent className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="space-y-1">
            <div className="text-sm font-bold text-foreground">Location SEO Profiles</div>
            <p className="text-xs text-muted-foreground leading-relaxed font-medium max-w-xl">
              DSPy will use these keywords to produce replies that are locally relevant and SEO aligned without
              keyword stuffing.
            </p>
          </div>
          <Badge variant="secondary" className="rounded-md font-mono text-[9px] h-5 px-2 bg-muted text-muted-foreground">
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
            {profiles.map((profile) => (
              <div key={profile.locationId} className="rounded-2xl border border-border bg-muted/30 p-3 md:p-4 space-y-4">
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
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            className="w-full sm:w-auto rounded-xl gap-2 h-9 text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-elevated min-w-[120px]"
            disabled={saving || profiles.length === 0}
            onClick={() => onSave(profiles)}
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
          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{config.label}</Label>
          <p className="text-xs text-muted-foreground font-medium">{config.hint}</p>
        </div>
        <Badge variant="secondary" className="rounded-md font-mono text-[9px] h-5 px-2 bg-muted text-muted-foreground">
          {values.length}/{config.max}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <Input
          className={cn("rounded-xl h-9 text-sm border-border", values.length >= config.max && "opacity-50")}
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
          className="rounded-xl h-9 text-xs border-border font-semibold shrink-0"
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
              className="rounded-lg gap-1.5 px-2.5 h-7 text-xs bg-card text-muted-foreground border border-border"
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
