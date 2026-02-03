import { spawnSync } from "node:child_process"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fail } from "./errors"
import { runCommand } from "./exec"
import { copyDir, ensureDir, pathExists, rmDir, writeFileText } from "./fs"
import { findBundledPath, getPackageInfo, resolvePackageDir } from "./package"

export async function resolveWebRuntimeSourceDir(): Promise<string> {
  const bundled = findBundledPath(["templates", "web-runtime"])
  if (bundled) return bundled

  const pkg = getPackageInfo()
  if (pkg.rootDir) {
    const monorepoDir = path.resolve(pkg.rootDir, "..", "web-runtime")
    if (await pathExists(monorepoDir)) return monorepoDir
  }

  const packageDir = resolvePackageDir("@gittydocs/web-runtime")
  if (packageDir) return packageDir

  fail("Missing bundled web runtime")
}

export async function ensureWebRuntimeDir(): Promise<string> {
  assertBunInstalled()

  const bundledWebDir = await resolveWebRuntimeSourceDir()

  const pkg = getPackageInfo()
  const version = pkg.version ?? "dev"
  const cacheDir = path.join(getCacheRoot(), "web", version)
  const markerPath = path.join(cacheDir, ".gittydocs-version")

  const markerOk =
    (await pathExists(markerPath)) &&
    (await fs.readFile(markerPath, "utf-8").catch(() => "")).trim() === version
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
