import { defineConfig, devices } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

const PORT = Number(process.env.PORT ?? 3000)

function resolveAppCwd() {
  const cwd = process.cwd()
  if (fs.existsSync(path.join(cwd, "package.json"))) return cwd

  // Helpful when running commands from the parent folder (common with spaces in paths).
  const nested = path.join(cwd, "googlereview")
  if (fs.existsSync(path.join(nested, "package.json"))) return nested

  // Last resort: try config directory (can be a Playwright cache dir, so this may still fail).
  if (fs.existsSync(path.join(__dirname, "package.json"))) return __dirname
  if (fs.existsSync(path.join(__dirname, "..", "package.json"))) return path.join(__dirname, "..")

  return cwd
}

const APP_CWD = resolveAppCwd()

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    // Force correct working directory even if Playwright is launched from elsewhere.
    command: `pnpm -C '${APP_CWD}' dev --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...(process.env as Record<string, string>),
      DISABLE_CRON: "true",
    },
  },
})
