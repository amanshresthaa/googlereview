import { z } from "zod"

const optionalNonEmptyString = z.preprocess((v) => {
  if (typeof v !== "string") return v
  const trimmed = v.trim()
  return trimmed.length === 0 ? undefined : trimmed
}, z.string().min(1).optional())

const optionalUrlString = z.preprocess((v) => {
  if (typeof v !== "string") return v
  const trimmed = v.trim()
  return trimmed.length === 0 ? undefined : trimmed
}, z.string().url().optional())

const serverSchema = z.object({
  DATABASE_URL: z.string().min(1),
  // Used by Prisma CLI for migrations in environments where DATABASE_URL points to a pooler.
  DIRECT_DATABASE_URL: optionalNonEmptyString,
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).optional(),
  DB_POOL_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(500).max(60_000).optional(),
  DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(300_000).optional(),
  DB_POOL_QUERY_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).optional(),

  NEXTAUTH_SECRET: z.string().min(1),
  NEXTAUTH_URL: optionalUrlString,

  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),

  TOKEN_ENCRYPTION_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(1),
})

const dspySchema = z.object({
  DSPY_SERVICE_BASE_URL: z.string().url(),
  DSPY_SERVICE_TOKEN: z.string().min(1),
  DSPY_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
})

let _serverEnv: z.infer<typeof serverSchema> | null = null
let _dspyEnv: z.infer<typeof dspySchema> | null = null

export function env() {
  if (_serverEnv) return _serverEnv

  const parsed = serverSchema.safeParse(process.env)
  if (!parsed.success) {
    // Keep error readable; never dump full env.
    const flattened = parsed.error.flatten().fieldErrors
    throw new Error(`Invalid environment variables: ${JSON.stringify(flattened)}`)
  }

  _serverEnv = parsed.data
  return _serverEnv
}

export function dspyEnv() {
  if (_dspyEnv) return _dspyEnv

  const parsed = dspySchema.safeParse(process.env)
  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors
    throw new Error(`Invalid DSPy environment variables: ${JSON.stringify(flattened)}`)
  }

  _dspyEnv = parsed.data
  return _dspyEnv
}
