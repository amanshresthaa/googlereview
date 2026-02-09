import { config as loadDotenv } from "dotenv"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { defineConfig, env } from "prisma/config"

// Prisma config files are statically analyzed by Prisma CLI.
// Keep this file declarative (no conditional logic) so commands like
// `prisma migrate deploy` can resolve the datasource URL reliably.
loadDotenv({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), ".env") })
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Use the direct connection for migrations. For runtime pooling, use DATABASE_URL in app code.
    url: env("DIRECT_DATABASE_URL"),
  },
})
