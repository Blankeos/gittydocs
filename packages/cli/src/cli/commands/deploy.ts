import type { CAC } from "cac"
import { confirm, isCancel, multiselect, note, outro } from "@clack/prompts"
import fs from "node:fs/promises"
import path from "node:path"
import { parse } from "jsonc-parser"
import { fail } from "../lib/errors"
import { ensureDir, pathExists, readFileText, writeFileText } from "../lib/fs"
import { getRepoRootFromCwd } from "../lib/repo"

type Provider = "ghpages" | "cfpages" | "vercel" | "netlify"

interface DeployOptions {
  cfpages?: boolean
  ghpages?: boolean
  vercel?: boolean
  netlify?: boolean
}

export function registerDeployCommand(cli: CAC) {
  cli
    .command("deploy", "Generate CI workflow(s) for deployment")
    .option("--cfpages", "Generate Cloudflare Pages workflow")
    .option("--ghpages", "Generate GitHub Pages workflow")
    .option("--vercel", "Generate Vercel workflow")
    .option("--netlify", "Generate Netlify workflow")
    .action(async (options: DeployOptions) => {
      const repoRoot = getRepoRootFromCwd()
      const config = await findLocalConfig(repoRoot)
      if (!config) {
        fail(
          "Could not find gittydocs config. Expected docs/gittydocs.jsonc (or similar).\n\n" +
            "Try: gittydocs new"
        )
      }

      const providerFlags = collectProvidersFromFlags(options)
      const providers = providerFlags.length > 0 ? providerFlags : await promptProviders()

      const workflowsDir = path.join(repoRoot, ".github", "workflows")
      await ensureDir(workflowsDir)

      const docsPath = config.docsDirRel
      const outDir = path.join("dist", "client")

      const multiple = providers.length > 1
      for (const provider of providers) {
        const fileName = multiple
          ? `deploy-gittydocs-${provider}.yml`
          : "deploy-gittydocs.yml"
        const workflowPath = path.join(workflowsDir, fileName)

        if (await pathExists(workflowPath)) {
          const overwrite = await confirm({
            message: `Workflow already exists at ${path.relative(repoRoot, workflowPath)}. Overwrite?`,
            initialValue: false,
          })
          if (isCancel(overwrite) || !overwrite) {
            continue
          }
        }

        const workflow = renderWorkflow({ provider, docsPath, outDir })
        await writeFileText(workflowPath, workflow)
        note(path.relative(repoRoot, workflowPath), "Wrote workflow")
      }

      note(renderWhatNext(providers), "What next")
      outro("Done.")
    })
}

function renderWhatNext(providers: Provider[]) {
  const lines: string[] = []
  lines.push("Commit and push:")
  lines.push("  git add .github/workflows")
  lines.push("  git commit -m \"deploy: add gittydocs workflow\"")
  lines.push("  git push")

  if (providers.includes("ghpages")) {
    lines.push("")
    lines.push("GitHub Pages:")
    lines.push("  Repo Settings -> Pages -> Source: GitHub Actions")
  }

  if (providers.includes("cfpages")) {
    lines.push("")
    lines.push("Cloudflare Pages:")
    lines.push("  Set secrets: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID")
    lines.push("  Ensure your Pages project name matches the repo name, or edit projectName")
  }

  if (providers.includes("netlify")) {
    lines.push("")
    lines.push("Netlify:")
    lines.push("  Set secrets: NETLIFY_AUTH_TOKEN, NETLIFY_SITE_ID")
  }

  if (providers.includes("vercel")) {
    lines.push("")
    lines.push("Vercel:")
    lines.push("  Set secret: VERCEL_TOKEN")
  }

  return lines.join("\n")
}

function collectProvidersFromFlags(options: DeployOptions): Provider[] {
  const providers: Provider[] = []
  if (options.ghpages) providers.push("ghpages")
  if (options.cfpages) providers.push("cfpages")
  if (options.vercel) providers.push("vercel")
  if (options.netlify) providers.push("netlify")
  return providers
}

async function promptProviders(): Promise<Provider[]> {
  const picked = await multiselect({
    message: "Select providers to generate workflows for",
    options: [
      { value: "ghpages", label: "GitHub Pages" },
      { value: "cfpages", label: "Cloudflare Pages" },
      { value: "vercel", label: "Vercel" },
      { value: "netlify", label: "Netlify" },
    ],
    required: true,
  })
  if (isCancel(picked)) process.exit(1)
  return picked as Provider[]
}

async function findLocalConfig(repoRoot: string) {
  const candidates = [
    path.join(repoRoot, "docs", "gittydocs.jsonc"),
    path.join(repoRoot, "docs", "gittydocs.json"),
    path.join(repoRoot, "gittydocs.jsonc"),
    path.join(repoRoot, "gittydocs.json"),
  ]

  for (const filePath of candidates) {
    if (!(await pathExists(filePath))) continue
    const docsDir = path.dirname(filePath)
    const docsDirRel = path.relative(repoRoot, docsDir).replace(/\\/g, "/") || "."
    const raw = await readFileText(filePath)
    const parsed = safeParseJsonc(raw)
    return { filePath, docsDir, docsDirRel, parsed }
  }

  // One-level deep scan: */gittydocs.jsonc
  const guessed = await findConfigOneLevelDeep(repoRoot)
  if (guessed) return guessed

  return null
}

async function findConfigOneLevelDeep(repoRoot: string) {
  // Avoid a full recursive scan.
  const entries = await fs.readdir(repoRoot, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dir = path.join(repoRoot, entry.name)
    for (const baseName of ["gittydocs.jsonc", "gittydocs.json"]) {
      const filePath = path.join(dir, baseName)
      if (!(await pathExists(filePath))) continue
      const docsDirRel = path.relative(repoRoot, dir).replace(/\\/g, "/") || "."
      const raw = await readFileText(filePath)
      const parsed = safeParseJsonc(raw)
      return { filePath, docsDir: dir, docsDirRel, parsed }
    }
  }
  return null
}

function safeParseJsonc(raw: string): unknown {
  try {
    return parse(raw)
  } catch {
    return null
  }
}

function renderWorkflow(input: { provider: Provider; docsPath: string; outDir: string }) {
  switch (input.provider) {
    case "ghpages":
      return renderGitHubPagesWorkflow(input)
    case "cfpages":
      return renderCloudflarePagesWorkflow(input)
    case "netlify":
      return renderNetlifyWorkflow(input)
    case "vercel":
      return renderVercelWorkflow(input)
    default:
      return ""
  }
}

function renderCommonBuildSteps(input: { docsPath: string }) {
  return `      - uses: actions/checkout@v4\n` +
    `      - uses: actions/setup-node@v4\n` +
    `        with:\n` +
    `          node-version: 20\n` +
    `      - uses: oven-sh/setup-bun@v2\n` +
    `      - run: npx gittydocs@latest build "./${input.docsPath}"\n`
}

function renderGitHubPagesWorkflow(input: { docsPath: string; outDir: string }) {
  return (
    `name: Deploy Gittydocs (GitHub Pages)\n` +
    `on:\n` +
    `  push:\n` +
    `    branches: [main]\n` +
    `permissions:\n` +
    `  contents: read\n` +
    `  pages: write\n` +
    `  id-token: write\n` +
    `jobs:\n` +
    `  deploy:\n` +
    `    runs-on: ubuntu-latest\n` +
    `    steps:\n` +
    renderCommonBuildSteps(input) +
    `      - uses: actions/upload-pages-artifact@v3\n` +
    `        with:\n` +
    `          path: ./${input.outDir}\n` +
    `      - uses: actions/deploy-pages@v4\n`
  )
}

function renderCloudflarePagesWorkflow(input: { docsPath: string; outDir: string }) {
  return (
    `name: Deploy Gittydocs (Cloudflare Pages)\n` +
    `on:\n` +
    `  push:\n` +
    `    branches: [main]\n` +
    `jobs:\n` +
    `  deploy:\n` +
    `    runs-on: ubuntu-latest\n` +
    `    steps:\n` +
    renderCommonBuildSteps(input) +
    `      - uses: cloudflare/pages-action@v1\n` +
    `        with:\n` +
    `          apiToken: \${{ secrets.CLOUDFLARE_API_TOKEN }}\n` +
    `          accountId: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}\n` +
    `          projectName: \${{ github.event.repository.name }}\n` +
    `          directory: ./${input.outDir}\n`
  )
}

function renderNetlifyWorkflow(input: { docsPath: string; outDir: string }) {
  return (
    `name: Deploy Gittydocs (Netlify)\n` +
    `on:\n` +
    `  push:\n` +
    `    branches: [main]\n` +
    `jobs:\n` +
    `  deploy:\n` +
    `    runs-on: ubuntu-latest\n` +
    `    steps:\n` +
    renderCommonBuildSteps(input) +
    `      - run: npx netlify-cli@latest deploy --dir="./${input.outDir}" --prod\n` +
    `        env:\n` +
    `          NETLIFY_AUTH_TOKEN: \${{ secrets.NETLIFY_AUTH_TOKEN }}\n` +
    `          NETLIFY_SITE_ID: \${{ secrets.NETLIFY_SITE_ID }}\n`
  )
}

function renderVercelWorkflow(input: { docsPath: string; outDir: string }) {
  return (
    `name: Deploy Gittydocs (Vercel)\n` +
    `on:\n` +
    `  push:\n` +
    `    branches: [main]\n` +
    `jobs:\n` +
    `  deploy:\n` +
    `    runs-on: ubuntu-latest\n` +
    `    steps:\n` +
    renderCommonBuildSteps(input) +
    `      - run: npx vercel@latest deploy --prod --yes --token="\${VERCEL_TOKEN}" "./${input.outDir}"\n` +
    `        env:\n` +
    `          VERCEL_TOKEN: \${{ secrets.VERCEL_TOKEN }}\n`
  )
}
