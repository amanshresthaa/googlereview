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

  NEXTAUTH_SECRET: z.string().min(1),
  NEXTAUTH_URL: optionalUrlString,

  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),

  TOKEN_ENCRYPTION_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(1),

  OPENAI_API_KEY: optionalNonEmptyString,
  OPENAI_MODEL_DRAFT: optionalNonEmptyString,
  OPENAI_MODEL_VERIFY: optionalNonEmptyString,

  GEMINI_API_KEY: optionalNonEmptyString,
  GEMINI_MODEL: optionalNonEmptyString,
})

let _serverEnv: z.infer<typeof serverSchema> | null = null

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
