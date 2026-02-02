import path from "node:path"
import dotenv from "dotenv"
import { fail } from "./errors"
import { pathExists } from "./fs"
import type { ResolvedSource } from "./source"

export async function loadEnv(input: {
  explicitEnvPath?: string
  source: ResolvedSource
}) {
  const envPath = await resolveEnvPath(input)
  if (!envPath) return { envPath: null }

  const result = dotenv.config({ path: envPath })
  if (result.error) {
    fail(`Failed to load env file: ${envPath}\n${String(result.error)}`)
  }

  return { envPath }
}

async function resolveEnvPath(input: {
  explicitEnvPath?: string
  source: ResolvedSource
}): Promise<string | null> {
  if (input.explicitEnvPath) {
    const p = path.resolve(process.cwd(), input.explicitEnvPath)
    if (!(await pathExists(p))) {
      fail(`--env file not found: ${p}`)
    }
    return p
  }

  if (input.source.kind === "local" && input.source.absPath) {
    const p = path.join(input.source.absPath, ".env")
    if (await pathExists(p)) return p
  }

  return null
}
