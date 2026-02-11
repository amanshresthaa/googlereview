import { fileURLToPath } from "node:url"
import type { NextConfig } from "next"
import path from "node:path"

const repoRoot = path.dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig & { allowedDevOrigins?: string[] } = {
  turbopack: {
    // Pin root to this repository so parent lockfiles do not affect module resolution.
    root: repoRoot,
  },
  // Used by Playwright (baseURL uses 127.0.0.1) and avoids future Next.js dev-origin restrictions.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.gstatic.com",
      },
    ],
  },
}

export default nextConfig
