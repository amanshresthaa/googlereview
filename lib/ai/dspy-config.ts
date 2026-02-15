import crypto from "node:crypto"
import { z } from "zod"

const optionalIdentifierSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}, z.string().min(1).max(120).optional())

const dspyExperimentSchema = z
  .object({
    id: z.preprocess((value) => {
      if (typeof value !== "string") return value
      const trimmed = value.trim()
      return trimmed.length > 0 ? trimmed : value
    }, z.string().min(1).max(80)),
    trafficPercent: z.number().min(0).max(100),
    programVersion: optionalIdentifierSchema,
    draftModel: optionalIdentifierSchema,
    verifyModel: optionalIdentifierSchema,
  })
  .strict()

export const dspyConfigSchema = z
  .object({
    programVersion: optionalIdentifierSchema,
    draftModel: optionalIdentifierSchema,
    verifyModel: optionalIdentifierSchema,
    experiments: z.array(dspyExperimentSchema).max(20).optional(),
  })
  .strict()

export type DspyConfig = z.infer<typeof dspyConfigSchema>

type DspyExperiment = z.infer<typeof dspyExperimentSchema>

type ExecutionFields = {
  programVersion: string | null
  draftModel: string | null
  verifyModel: string | null
}

export type DspyExecutionResolution = {
  experimentId: string | null
  bucketPercent: number
  effective: ExecutionFields
  snapshot: {
    org: DspyConfig | null
    location: DspyConfig | null
    base: ExecutionFields
    experiment:
      | {
          id: string
          trafficPercent: number
          programVersion: string | null
          draftModel: string | null
          verifyModel: string | null
        }
      | null
    effective: ExecutionFields
    bucketPercent: number
  }
}

export function parseStoredDspyConfig(input: unknown): DspyConfig | null {
  if (!input || typeof input !== "object") return null
  const parsed = dspyConfigSchema.safeParse(input)
  if (!parsed.success) return null
  return normalizeConfig(parsed.data)
}

export function normalizeDspyConfigInput(input: DspyConfig | null | undefined): DspyConfig | null {
  if (input == null) return null
  return normalizeConfig(input)
}

export function resolveDspyExecution(input: {
  orgId: string
  reviewId: string
  orgConfig: DspyConfig | null
  locationConfig: DspyConfig | null
}): DspyExecutionResolution {
  const orgConfig = input.orgConfig
  const locationConfig = input.locationConfig

  const base: ExecutionFields = {
    programVersion: locationConfig?.programVersion ?? orgConfig?.programVersion ?? null,
    draftModel: locationConfig?.draftModel ?? orgConfig?.draftModel ?? null,
    verifyModel: locationConfig?.verifyModel ?? orgConfig?.verifyModel ?? null,
  }

  const experiments = locationConfig?.experiments ?? orgConfig?.experiments ?? []
  const bucketPercent = bucketFromStableKey(`${input.orgId}:${input.reviewId}`)
  const experiment = selectExperiment(experiments, bucketPercent)

  const effective: ExecutionFields = {
    programVersion: experiment?.programVersion ?? base.programVersion,
    draftModel: experiment?.draftModel ?? base.draftModel,
    verifyModel: experiment?.verifyModel ?? base.verifyModel,
  }

  return {
    experimentId: experiment?.id ?? null,
    bucketPercent,
    effective,
    snapshot: {
      org: orgConfig,
      location: locationConfig,
      base,
      experiment: experiment
        ? {
            ...experiment,
            programVersion: experiment.programVersion ?? null,
            draftModel: experiment.draftModel ?? null,
            verifyModel: experiment.verifyModel ?? null,
          }
        : null,
      effective,
      bucketPercent,
    },
  }
}

function normalizeConfig(config: DspyConfig): DspyConfig {
  const dedupedExperiments = new Set<string>()
  const experiments = (config.experiments ?? [])
    .map((experiment) => ({
      id: experiment.id.trim(),
      trafficPercent: clampPercent(experiment.trafficPercent),
      programVersion: experiment.programVersion,
      draftModel: experiment.draftModel,
      verifyModel: experiment.verifyModel,
    }))
    .filter((experiment) => {
      if (dedupedExperiments.has(experiment.id)) return false
      dedupedExperiments.add(experiment.id)
      return true
    })

  return {
    programVersion: config.programVersion,
    draftModel: config.draftModel,
    verifyModel: config.verifyModel,
    ...(experiments.length > 0 ? { experiments } : {}),
  }
}

function selectExperiment(experiments: DspyExperiment[], bucketPercent: number): DspyExperiment | null {
  if (experiments.length === 0) return null

  let cumulative = 0
  for (const experiment of experiments) {
    cumulative += clampPercent(experiment.trafficPercent)
    if (bucketPercent < cumulative) {
      return experiment
    }
    if (cumulative >= 100) {
      return null
    }
  }

  return null
}

function bucketFromStableKey(key: string): number {
  const digest = crypto.createHash("sha256").update(key).digest("hex")
  const first = Number.parseInt(digest.slice(0, 8), 16)
  if (!Number.isFinite(first) || first < 0) return 0
  return (first % 10_000) / 100
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0
  if (value <= 0) return 0
  if (value >= 100) return 100
  return Math.round(value * 100) / 100
}
