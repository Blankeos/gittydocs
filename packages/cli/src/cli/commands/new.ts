import type { CAC } from "cac"
import path from "node:path"
import { isCancel, note, outro, select, text } from "@clack/prompts"
import { fail } from "../lib/errors"
import { copyDir, ensureDir, isDirEmpty, pathExists, writeFileText } from "../lib/fs"
import { findBundledPath, resolvePackageDir } from "../lib/package"

interface NewOptions {
  default?: boolean
  ejected?: boolean
}

export function registerNewCommand(cli: CAC) {
  cli
    .command("new [folder]", "Scaffold a new Gittydocs setup")
    .option("--default", "Minimal docs-only scaffold (default)")
    .option("--ejected", "Full app scaffold (customizable)")
    .action(async (folder: string | undefined, options: NewOptions) => {
      const resolvedFolder = folder ?? (await promptFolder())
      let mode = resolveMode(options)
      if (!folder && !options.default && !options.ejected) {
        mode = await promptMode()
      }
      const targetDir = path.resolve(process.cwd(), resolvedFolder)

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
          `Created ${resolvedFolder}.\n\n` +
            `Next:\n` +
            `  cd ${resolvedFolder}\n` +
            `  gittydocs dev docs\n`
        )
        return
      }

      // ejected
      const webTemplateDir = resolvePackageDir("@gittydocs/web-runtime")
      if (!webTemplateDir) fail("Missing @gittydocs/web-runtime package")

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
      outro(`Created ejected project at ${resolvedFolder}`)
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

async function promptFolder(): Promise<string> {
  const value = await text({
    message: "Folder name",
    placeholder: "docs",
    validate: (input) => (input.trim().length === 0 ? "Folder is required" : undefined),
  })
  if (isCancel(value)) process.exit(1)
  return value.trim()
}

async function promptMode(): Promise<"default" | "ejected"> {
  const picked = await select({
    message: "Select scaffold type",
    options: [
      {
        value: "default",
        label: "Docs-only: minimal config, easy updates (Recommended)",
      },
      {
        value: "ejected",
        label: "Ejected: full customization in SolidJS + Vike, you maintain updates",
      },
    ],
    initialValue: "default",
  })
  if (isCancel(picked)) process.exit(1)
  return picked as "default" | "ejected"
}
