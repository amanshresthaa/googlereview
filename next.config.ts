import type { NextConfig } from "next"
import path from "node:path"

const nextConfig: NextConfig & { allowedDevOrigins?: string[] } = {
  turbopack: {
    root: path.join(__dirname),
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
