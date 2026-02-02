import type { CAC } from "cac"
import path from "node:path"
import { note, outro } from "@clack/prompts"
import { fail } from "../lib/errors"
import { copyDir, ensureDir, isDirEmpty, pathExists, writeFileText } from "../lib/fs"
import { findBundledPath } from "../lib/package"

interface NewOptions {
  default?: boolean
  ejected?: boolean
}

export function registerNewCommand(cli: CAC) {
  cli
    .command("new <folder>", "Scaffold a new Gittydocs setup")
    .option("--default", "Minimal docs-only scaffold (default)")
    .option("--ejected", "Full app scaffold (customizable)")
    .action(async (folder: string, options: NewOptions) => {
      const mode = resolveMode(options)
      const targetDir = path.resolve(process.cwd(), folder)

      if (await pathExists(targetDir)) {
        const empty = await isDirEmpty(targetDir)
        if (!empty) {
          fail(`Target folder is not empty: ${targetDir}`)
        }
      } else {
        await ensureDir(targetDir)
      }

      if (mode === "default") {
        const templateDir = findBundledPath(["templates", "default"])
        if (!templateDir) fail("Missing bundled template: templates/default")
        await copyDir(templateDir, targetDir)
        outro(
          `Created ${folder}.\n\n` +
            `Next:\n` +
            `  cd ${folder}\n` +
            `  gittydocs dev docs\n`
        )
        return
      }

      // ejected
      const webTemplateDir = findBundledPath(["apps", "web"])
      if (!webTemplateDir) fail("Missing bundled web template: apps/web")

      await copyDir(webTemplateDir, targetDir, {
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

      const ejectedOverlayDir = findBundledPath(["templates", "ejected"])
      if (ejectedOverlayDir) {
        await copyDir(ejectedOverlayDir, targetDir)
      }

      const defaultDocsDir = findBundledPath(["templates", "default", "docs"])
      if (defaultDocsDir) {
        await copyDir(defaultDocsDir, path.join(targetDir, "docs"))
      }

      const envPath = path.join(targetDir, ".env")
      if (!(await pathExists(envPath))) {
        await writeFileText(envPath, "GITTYDOCS_SOURCE=./docs\n")
      }

      note("bun install\nbun run dev", "What next")
      outro(`Created ejected project at ${folder}`)
    })
}

function resolveMode(options: NewOptions): "default" | "ejected" {
  const hasDefault = Boolean(options.default)
  const hasEjected = Boolean(options.ejected)
  if (hasDefault && hasEjected) {
    fail("Choose only one: --default or --ejected")
  }
  if (hasEjected) return "ejected"
  return "default"
}
