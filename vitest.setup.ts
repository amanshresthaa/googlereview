import { config as loadDotenv } from "dotenv"
import path from "node:path"

// Ensure required env vars are present when importing server modules in tests.
// CI supplies env via workflow; locally we load from repo `.env`.
process.env.DOTENV_CONFIG_QUIET = "true"
loadDotenv({ path: path.join(process.cwd(), ".env") })
