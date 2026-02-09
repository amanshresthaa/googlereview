/* eslint-disable @typescript-eslint/no-explicit-any */

import NextAuth from "next-auth"
import type { NextRequest } from "next/server"
import { authOptions } from "@/lib/auth-options"

export const runtime = "nodejs"

export async function GET(req: NextRequest, ctx: any) {
  return NextAuth(req, ctx, authOptions())
}

export async function POST(req: NextRequest, ctx: any) {
  return NextAuth(req, ctx, authOptions())
}
