import { PrismaClient } from "@prisma/client"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { env } from "@/lib/env"

declare global {
  var prisma: PrismaClient | undefined
  var pgPool: Pool | undefined
}

function shouldUseSsl(connectionString: string) {
  // Supabase managed Postgres (direct or pooler) requires TLS. In many environments
  // (local dev, Vercel), validating the full chain may fail without providing the CA bundle.
  // Use rejectUnauthorized=false for Supabase hosts to keep the app functional.
  try {
    const u = new URL(connectionString)
    return (
      u.hostname.endsWith(".supabase.co") ||
      u.hostname.endsWith(".pooler.supabase.com") ||
      u.hostname.includes(".supabase.")
    )
  } catch {
    return (
      connectionString.includes(".supabase.co") || connectionString.includes(".pooler.supabase.com")
    )
  }
}

function getPool() {
  if (globalThis.pgPool) return globalThis.pgPool
  const e = env()
  const pool = new Pool({
    connectionString: e.DATABASE_URL,
    max: 5,
    ssl: shouldUseSsl(e.DATABASE_URL) ? { rejectUnauthorized: false } : undefined,
  })
  if (process.env.NODE_ENV !== "production") globalThis.pgPool = pool
  return pool
}

export const prisma =
  globalThis.prisma ??
  new PrismaClient({
    adapter: new PrismaPg(getPool()),
    log: ["error", "warn"],
  })

if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma
