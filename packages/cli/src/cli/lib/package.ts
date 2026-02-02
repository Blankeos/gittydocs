import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

export function getPackageInfo(): { rootDir: string | null; version: string | null } {
  const rootDir = findPackageRoot()
  if (!rootDir) return { rootDir: null, version: null }
  const pkgPath = path.join(rootDir, "package.json")
  try {
    const raw = fs.readFileSync(pkgPath, "utf-8")
    const parsed = JSON.parse(raw) as { version?: unknown }
    const version = typeof parsed.version === "string" ? parsed.version : null
    return { rootDir, version }
  } catch {
    return { rootDir, version: null }
  }
}

export function findBundledPath(parts: string[]): string | null {
  const rootDir = findPackageRoot()
  if (!rootDir) return null
  const candidate = path.join(rootDir, ...parts)
  if (!fs.existsSync(candidate)) return null
  return candidate
}

function findPackageRoot(): string | null {
  const start = path.dirname(fileURLToPath(import.meta.url))
  let dir = start
  for (let i = 0; i < 25; i++) {
    const candidate = path.join(dir, "package.json")
    if (fs.existsSync(candidate)) return dir
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}
