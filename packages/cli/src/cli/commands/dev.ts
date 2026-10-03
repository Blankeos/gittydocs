import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import path from "node:path"
import type { CAC } from "cac"
import chokidar from "chokidar"
import { parse } from "jsonc-parser"
import { findGittydocsConfigPath } from "../lib/config"
import { loadEnv } from "../lib/env"
import { fail } from "../lib/errors"
import { runCommand, spawnLongRunning } from "../lib/exec"
import { openUrl } from "../lib/open"
import { resolveSource } from "../lib/source"
import { ensureWebRuntimeDir } from "../lib/web-runtime"

const shield = "\u{1F6E1}"
const useColor = process.stdout.isTTY && !process.env.NO_COLOR
const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
}

const colorize = (value: string, color: string) =>
  useColor ? `${color}${value}${colors.reset}` : value

const logPrefix = colorize(`[${shield} gittydocs]`, colors.cyan)
const label = (value: string) => colorize(value, colors.gray)

interface DevOptions {
  env?: string
  port?: string
  open?: boolean
}

export function registerDevCommand(cli: CAC) {
  cli
    .command("dev [gittydocsSource]", "Run local dev server")
    .option("--env <path>", "Explicit env file")
    .option("--port <number>", "Dev server port override")
    .option("--open", "Open browser")
    .action(async (gittydocsSource: string | undefined, options: DevOptions) => {
      const source = await resolveSource(gittydocsSource)
      const envInfo = await loadEnv({ explicitEnvPath: options.env, source })

      const webDir = await ensureWebRuntimeDir()
      const port = options.port ? parsePort(options.port) : 3000

      process.stdout.write(`${logPrefix} preparing docs\n`)
      await runCommand({
        cwd: webDir,
        command: "bun",
        args: ["run", "prepare:docs"],
        env: {
          ...process.env,
          GITTYDOCS_SOURCE: source.value,
        },
      })
      process.stdout.write(`${logPrefix} docs ready ✔︎\n\n`)

      process.stdout.write(`${logPrefix} dev server\n`)
      process.stdout.write(`  ${label("source")}: ${source.value}\n`)
      if (source.kind === "local" && source.absPath) {
        const configPath = await findGittydocsConfigPath(source.absPath)
        process.stdout.write(`  ${label("config")}: ${configPath ?? "(none)"}\n`)
      }
      process.stdout.write(`  ${label("env")}: ${envInfo.envPath ?? "(none)"}\n`)
      process.stdout.write(`  ${label("web runtime")}: ${webDir}\n`)
      process.stdout.write(`  ${label("url")}: http://localhost:${port}\n\n`)

      const velite = spawnLongRunning({
        cwd: webDir,
        command: "bun",
        args: ["x", "velite", "dev"],
        env: {
          ...process.env,
          GITTYDOCS_SOURCE: source.value,
        },
        prefix: "velite",
      })

      // vike dev occasionally expects velite to be up first
      await new Promise((r) => setTimeout(r, 1000))

      let opened = false
      const vike = spawnLongRunning({
        cwd: webDir,
        command: "bun",
        args: ["x", "--bun", "vike", "dev", "--port", String(port)],
        env: {
          ...process.env,
          GITTYDOCS_SOURCE: source.value,
        },
        prefix: "vike",
        onStdoutLine(line) {
          if (opened || !options.open) return
          const match = line.match(/https?:\/\/localhost:\d+/)
          if (match) {
            opened = true
            void openUrl(match[0])
          }
        },
      })

      const stopWatching =
        source.kind === "local" && source.absPath
          ? await startPrepareDocsWatcher({
              sourceDir: source.absPath,
              webDir,
              sourceValue: source.value,
            })
          : undefined

      const killAll = () => {
        void stopWatching?.()
        velite.kill("SIGTERM")
        vike.kill("SIGTERM")
      }
      process.on("SIGINT", () => {
        killAll()
        process.exit(0)
      })
      process.on("SIGTERM", () => {
        killAll()
        process.exit(0)
      })
    })
}

function parsePort(value: string): number {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    fail(`Invalid --port: ${value}`)
  }
  return n
}

export async function startPrepareDocsWatcher(input: {
  sourceDir: string
  webDir: string
  sourceValue: string
}) {
  const watcher = chokidar.watch(input.sourceDir, {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 250,
      pollInterval: 50,
    },
    ignored: ["**/.git/**", "**/node_modules/**", "**/dist/**"],
  })

  let running = false
  let queued = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let externalManifests = new Set<string>()
  // Watch parent directories shallowly, not just files: chokidar otherwise stops
  // observing an explicitly watched file after deletion while other roots exist.
  const manifestWatcherOptions = {
    ignoreInitial: true,
    depth: 0,
    awaitWriteFinish: { stabilityThreshold: 250, pollInterval: 50 },
  }
  const manifestWatchers = new Map<string, ReturnType<typeof chokidar.watch>>()
  let stopped = false

  const refreshManifestWatches = async () => {
    if (stopped) return
    const manifests = new Set<string>()
    // Preparation uses Bun's TOML parser to discover inherited Cargo workspaces.
    // Read its private metadata instead of importing Bun-only code into the Node CLI.
    const metadataPath = path.join(input.webDir, ".gittydocs-version-manifests.json")
    try {
      const paths: unknown = JSON.parse(await fs.readFile(metadataPath, "utf-8"))
      if (Array.isArray(paths)) {
        for (const manifest of paths) {
          if (typeof manifest === "string" && path.isAbsolute(manifest)) manifests.add(manifest)
        }
      }
    } catch {
      // An older runtime may not have metadata; the direct config reference still works.
    }
    const configPath = await findGittydocsConfigPath(input.sourceDir)
    if (configPath) {
      try {
        const config = parse(await fs.readFile(configPath, "utf-8"))
        const version = config?.site?.version
        const reference = version?.packageJson ?? version?.cargoToml
        if (typeof version === "object" && typeof reference === "string" && reference.trim()) {
          manifests.add(path.resolve(path.dirname(configPath), reference))
        }
      } catch {
        // The preparation command reports invalid config with an actionable error.
      }
    }
    const outsideSource = new Set(
      [...manifests].filter((manifest) => {
        const relative = path.relative(input.sourceDir, manifest)
        return (
          relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)
        )
      })
    )
    const newDirs = new Set([...outsideSource].map((manifest) => path.dirname(manifest)))
    externalManifests = outsideSource
    for (const [dir, manifestWatcher] of manifestWatchers) {
      if (!newDirs.has(dir)) {
        await manifestWatcher.close()
        manifestWatchers.delete(dir)
      }
    }
    // Independent shallow roots avoid depth conflicts when both an ancestor
    // Cargo workspace and a nested member manifest are referenced.
    for (const dir of newDirs) {
      if (manifestWatchers.has(dir)) continue
      const manifestWatcher = chokidar.watch(dir, manifestWatcherOptions)
      manifestWatchers.set(dir, manifestWatcher)
      manifestWatcher.on("all", (_event, manifestPath) => {
        if (externalManifests.has(path.resolve(manifestPath))) onAny()
      })
      manifestWatcher.on("error", (error) => {
        process.stderr.write(`\n${logPrefix} [watch] manifest watcher failed: ${String(error)}\n`)
      })
      await new Promise<void>((resolve) => manifestWatcher.once("ready", resolve))
    }
  }

  const run = async () => {
    if (stopped) return
    if (running) {
      queued = true
      return
    }
    running = true
    queued = false

    try {
      await refreshManifestWatches()
      await runPrepareDocsRefresh({
        cwd: input.webDir,
        env: {
          ...process.env,
          GITTYDOCS_SOURCE: input.sourceValue,
        },
      })
    } catch (error) {
      process.stderr.write(`\n${logPrefix} [watch] prepare:docs failed: ${String(error)}\n`)
    } finally {
      await refreshManifestWatches().catch((error) => {
        process.stderr.write(`\n${logPrefix} [watch] manifest refresh failed: ${String(error)}\n`)
      })
      running = false
      if (queued) {
        void run()
      }
    }
  }

  const onAny = () => {
    if (stopped) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      void run()
    }, 250)
  }

  watcher.on("add", onAny)
  watcher.on("change", onAny)
  watcher.on("unlink", onAny)
  watcher.on("addDir", onAny)
  watcher.on("unlinkDir", onAny)
  watcher.on("error", (error) => {
    process.stderr.write(`\n${logPrefix} [watch] watcher failed: ${String(error)}\n`)
  })
  await refreshManifestWatches()
  return async () => {
    stopped = true
    if (timer) clearTimeout(timer)
    await Promise.all([watcher.close(), ...[...manifestWatchers.values()].map((w) => w.close())])
  }
}

// runCommand intentionally exits on failures; dev refreshes must stay alive so
// an invalid or missing manifest can be fixed without restarting the server.
function runPrepareDocsRefresh(input: { cwd: string; env: NodeJS.ProcessEnv }): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("bun", ["run", "prepare:docs"], { ...input, stdio: "inherit" })
    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`prepare:docs exited with code ${code}`))
    })
  })
}
