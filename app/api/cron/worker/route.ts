import { NextResponse } from "next/server"
import crypto from "node:crypto"
import { env } from "@/lib/env"
import { runWorkerOnce } from "@/lib/jobs/worker"
import { scheduleReviewSyncJobs } from "@/lib/jobs/scheduler"

export const runtime = "nodejs"

async function handle(req: Request) {
  const e = env()
  const auth = req.headers.get("authorization") ?? ""
  const expected = `Bearer ${e.CRON_SECRET}`
  if (auth !== expected) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  const scheduler = await scheduleReviewSyncJobs({
    minStalenessMs: 5 * 60_000,
    limit: 50,
  })

  const workerId = crypto.randomUUID()
  const run = await runWorkerOnce({ limit: 10, workerId })

  return NextResponse.json({
    scheduled: scheduler,
    worker: run,
  })
}

// Vercel Cron Jobs invoke endpoints using GET requests.
export async function GET(req: Request) {
  return handle(req)
}

export async function POST(req: Request) {
  return handle(req)
}
