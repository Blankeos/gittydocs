import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { spawnSync } from "node:child_process"
import { fail } from "./errors"
import { copyDir, ensureDir, pathExists, rmDir, writeFileText } from "./fs"
import { getPackageInfo, resolvePackageDir } from "./package"
import { runCommand } from "./exec"

export async function ensureWebRuntimeDir(): Promise<string> {
  assertBunInstalled()

  const bundledWebDir = resolvePackageDir("@gittydocs/web-runtime")
  if (!bundledWebDir) {
    fail("Could not locate @gittydocs/web-runtime package")
  }

  const pkg = getPackageInfo()
  const version = pkg.version ?? "dev"
  const cacheDir = path.join(getCacheRoot(), "web", version)
  const markerPath = path.join(cacheDir, ".gittydocs-version")

  const markerOk = (await pathExists(markerPath)) && (await fs.readFile(markerPath, "utf-8").catch(() => "")).trim() === version
  if (!markerOk) {
    await rmDir(cacheDir)
    await ensureDir(cacheDir)
    await copyDir(bundledWebDir, cacheDir, {
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
    await writeFileText(markerPath, `${version}\n`)
  }

  const nodeModules = path.join(cacheDir, "node_modules")
  if (!(await pathExists(nodeModules))) {
    await runCommand({
      cwd: cacheDir,
      command: "bun",
      args: ["install"],
      env: process.env,
    })
  }

  return cacheDir
}

export async function clearWebRuntimeCache(options?: { all?: boolean }) {
  const cacheRoot = getCacheRoot()
  const webRoot = path.join(cacheRoot, "web")

  if (options?.all) {
    await rmDir(webRoot)
    return { cleared: [webRoot], scope: "all" as const }
  }

  const pkg = getPackageInfo()
  const version = pkg.version ?? "dev"
  const cacheDir = path.join(webRoot, version)
  await rmDir(cacheDir)
  return { cleared: [cacheDir], scope: "version" as const, version }
}

function assertBunInstalled() {
  const result = spawnSync("bun", ["--version"], { stdio: "ignore" })
  if (result.error || result.status !== 0) {
    fail(
      "bun is required for gittydocs dev/build.\n\n" +
        "Install bun: https://bun.sh/docs/installation"
    )
  }
}

function getCacheRoot() {
  const xdg = process.env.XDG_CACHE_HOME
  if (xdg && xdg.trim()) return path.join(xdg, "gittydocs")
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Caches", "gittydocs")
  }
  if (process.platform === "win32") {
    const local = process.env.LOCALAPPDATA
    if (local && local.trim()) return path.join(local, "gittydocs", "Cache")
    return path.join(os.homedir(), "AppData", "Local", "gittydocs", "Cache")
  }
  return path.join(os.homedir(), ".cache", "gittydocs")
}
