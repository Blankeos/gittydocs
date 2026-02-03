import path from "node:path"
import type { CAC } from "cac"
import chokidar from "chokidar"
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

      if (source.kind === "local" && source.absPath) {
        startPrepareDocsWatcher({
          sourceDir: source.absPath,
          webDir,
          sourceValue: source.value,
        })
      }

      const killAll = () => {
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

function startPrepareDocsWatcher(input: {
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
  let lastRunAt = 0

  const run = async () => {
    if (running) {
      queued = true
      return
    }
    running = true
    queued = false
    lastRunAt = Date.now()

    try {
      await runCommand({
        cwd: input.webDir,
        command: "bun",
        args: ["run", "prepare:docs"],
        env: {
          ...process.env,
          GITTYDOCS_SOURCE: input.sourceValue,
        },
      })
    } catch (error) {
      process.stderr.write(`\n${logPrefix} [watch] prepare:docs failed: ${String(error)}\n`)
    } finally {
      running = false
      if (queued) {
        void run()
      }
    }
  }

  const onAny = () => {
    const now = Date.now()
    if (now - lastRunAt < 250) {
      queued = true
      return
    }
    void run()
  }

  watcher.on("add", onAny)
  watcher.on("change", onAny)
  watcher.on("unlink", onAny)
  watcher.on("addDir", onAny)
  watcher.on("unlinkDir", onAny)
}
