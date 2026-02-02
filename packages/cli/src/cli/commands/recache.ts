import type { CAC } from "cac"
import { clearWebRuntimeCache } from "../lib/web-runtime"

interface RecacheOptions {
  all?: boolean
}

export function registerRecacheCommand(cli: CAC) {
  cli
    .command("recache", "Clear the cached web runtime")
    .option("--all", "Clear all cached runtime versions")
    .action(async (options: RecacheOptions) => {
      const result = await clearWebRuntimeCache({ all: options.all })
      const clearedPath = result.cleared[0]

      if (result.scope === "all") {
        process.stdout.write(`Cleared all cached runtimes at: ${clearedPath}\n`)
        process.stdout.write("Next dev/build will re-download dependencies.\n")
        return
      }

      process.stdout.write(`Cleared cached runtime for ${result.version ?? "current"}: ${clearedPath}\n`)
      process.stdout.write("Next dev/build will recreate the runtime.\n")
    })
}
