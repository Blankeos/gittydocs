import path from "node:path"
import { fileURLToPath } from "node:url"
import { copyDir, ensureDir, pathExists, rmDir } from "../src/cli/lib/fs"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const cliRoot = path.resolve(scriptDir, "..")
const runtimeSource = path.resolve(cliRoot, "..", "web-runtime")
const runtimeDest = path.resolve(cliRoot, "templates", "web-runtime")

if (!(await pathExists(runtimeSource))) {
  throw new Error(`Missing web runtime source: ${runtimeSource}`)
}

await rmDir(runtimeDest)
await ensureDir(runtimeDest)

await copyDir(runtimeSource, runtimeDest, {
  ignoreNames: new Set([".git", ".DS_Store"]),
  ignoreRelPathPrefixes: [
    "node_modules",
    "dist",
    "dist-ssr",
    ".velite",
    "content",
    ".env",
    "public/static",
    "public/llms",
  ],
})

process.stdout.write(`Synced web runtime to ${runtimeDest}\n`)
