import path from "node:path"
import { fail } from "./errors"
import { isDirectory } from "./validate"
import { pathExists } from "./fs"

export interface ResolvedSource {
  kind: "github" | "local"
  value: string
  absPath?: string
}

export async function resolveSource(input?: string): Promise<ResolvedSource> {
  const raw = (input ?? process.env.GITTYDOCS_SOURCE ?? ".").trim()
  if (!raw) {
    return { kind: "local", value: ".", absPath: path.resolve(process.cwd(), ".") }
  }

  if (isGitHubUrl(raw)) {
    return { kind: "github", value: raw }
  }

  const absPath = path.resolve(process.cwd(), raw)
  if (!(await pathExists(absPath))) {
    fail(`Source not found: ${absPath}`)
  }
  const dirOk = await isDirectory(absPath)
  if (!dirOk) {
    fail(`Source must be a directory: ${absPath}`)
  }

  return { kind: "local", value: absPath, absPath }
}

function isGitHubUrl(value: string) {
  return /^https?:\/\/(www\.)?github\.com\//i.test(value)
}
