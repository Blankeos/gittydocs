import type { CAC } from "cac"
import path from "node:path"
import { loadEnv } from "../lib/env"
import { fail } from "../lib/errors"
import { copyDir, ensureDir, pathExists, rmDir } from "../lib/fs"
import { runCommand } from "../lib/exec"
import { resolveSource } from "../lib/source"
import { ensureWebRuntimeDir } from "../lib/web-runtime"

interface BuildOptions {
  env?: string
  out?: string
}

export function registerBuildCommand(cli: CAC) {
  cli
    .command("build [gittydocsSource]", "Build docs site (static export)")
    .option("--env <path>", "Explicit env file")
    .option("--out <path>", "Output directory (defaults to dist/client)")
    .action(async (gittydocsSource: string | undefined, options: BuildOptions) => {
      const source = await resolveSource(gittydocsSource)
      await loadEnv({ explicitEnvPath: options.env, source })

      const webDir = await ensureWebRuntimeDir()
      const outDir = path.resolve(process.cwd(), options.out ?? path.join("dist", "client"))

      await runCommand({
        cwd: webDir,
        command: "bun",
        args: ["run", "build"],
        env: {
          ...process.env,
          GITTYDOCS_SOURCE: source.value,
        },
      })

      const builtClientDir = path.join(webDir, "dist", "client")
      if (!(await pathExists(builtClientDir))) {
        fail(`Build finished but output missing: ${builtClientDir}`)
      }

      await rmDir(outDir)
      await ensureDir(path.dirname(outDir))
      await copyDir(builtClientDir, outDir)

      process.stdout.write(`\nBuilt site to: ${outDir}\n`)
    })
}
