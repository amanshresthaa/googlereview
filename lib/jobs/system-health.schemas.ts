import { z } from "zod"
import type { JobStatus, JobType } from "@prisma/client"

export const jobStatusSchema = z.enum([
  "PENDING",
  "RUNNING",
  "RETRYING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]) satisfies z.ZodType<JobStatus>

export const jobTypeSchema = z.enum([
  "SYNC_LOCATIONS",
  "SYNC_REVIEWS",
  "PROCESS_REVIEW",
  "POST_REPLY",
]) satisfies z.ZodType<JobType>

export const jobOrderSchema = z.enum(["RUN_AT_ASC", "COMPLETED_AT_DESC", "CREATED_AT_DESC"])

export type JobOrder = z.infer<typeof jobOrderSchema>

export const jobListFilterSchema = z.object({
  status: z.array(jobStatusSchema).min(1).optional(),
  type: z.array(jobTypeSchema).min(1).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  order: jobOrderSchema.optional(),
  q: z.string().min(1).max(120).optional(),
  stale: z.boolean().optional(),
  includePayload: z.boolean().optional(),
})

export type JobListFilter = z.infer<typeof jobListFilterSchema>

export const jobActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("RUN_NOW") }),
  z.object({ action: z.literal("CANCEL") }),
  z.object({ action: z.literal("FORCE_UNLOCK") }),
  z.object({ action: z.literal("REQUEUE") }),
  z.object({ action: z.literal("RESCHEDULE"), runAtIso: z.string().datetime() }),
])

export type JobAction = z.infer<typeof jobActionSchema>

export const bulkJobActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("FORCE_UNLOCK_STALE"),
    jobIds: z.array(z.string().min(1)).min(1).max(50),
  }),
])

export type BulkJobAction = z.infer<typeof bulkJobActionSchema>

export const jobEnqueueSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("SYNC_LOCATIONS") }),
  z.object({
    type: z.literal("SYNC_REVIEWS"),
    mode: z.enum(["ALL_ENABLED", "ONE_LOCATION"]),
    locationId: z.string().min(1).optional(),
  }),
])

export type JobEnqueueInput = z.infer<typeof jobEnqueueSchema>
