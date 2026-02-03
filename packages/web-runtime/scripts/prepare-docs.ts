import fs from "fs/promises"
import { parse } from "jsonc-parser"
import path from "path"

interface GitHubSource {
  owner: string
  repo: string
  ref: string
  docsPath: string
}

interface PreparedSource {
  type: "github" | "local"
  source: string
  repo?: GitHubSource
}

interface DocsConfig {
  site?: {
    name?: string
    description?: string
    logo?: string
    favicon?: string
    socialBanner?: string
    repo?: GitHubSource
  }
  nav?: unknown
  links?: {
    github?: string
    issues?: string
  }
  theme?: {
    preset?: string
    cssFile?: string
  }
  llms?: {
    enabled?: boolean
  }
}

interface NavItem {
  label: string
  path?: string
  items?: NavItem[]
  accordion?: boolean
}

const projectRoot = process.cwd()
const contentRoot = path.join(projectRoot, "content")
const docsRoot = path.join(contentRoot, "docs")
const publicStaticRoot = path.join(projectRoot, "public", "static")
const sourceInput = process.env.GITTYDOCS_SOURCE || "../../docs"
const githubToken = process.env.GITHUB_TOKEN

const docsExtensions = new Set([".md", ".mdx"])
const staticExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".ico",
  ".pdf",
  ".mp4",
  ".webm",
  ".mp3",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
])
const configFiles = ["gittydocs.jsonc", "gittydocs.json"]
const shield = "\u{1F6E1}"
const useColor = process.stdout.isTTY && !process.env.NO_COLOR
const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
}
const colorize = (value: string, color: string) =>
  useColor ? `${color}${value}${colors.reset}` : value
const logPrefix = colorize(`[${shield} gittydocs]`, colors.cyan)

const llmsTitleByRoute = new Map<string, string>()
const llmsDescriptionByRoute = new Map<string, string>()
const llmsPathByRoute = new Map<string, string>()

try {
  await prepareDocs()
  console.log(`\n${logPrefix} ✓ prepare:docs complete`)
  process.exit(0)
} catch (error) {
  console.error(`\n${logPrefix} ✗ prepare:docs failed:`, error)
  process.exit(1)
}

async function prepareDocs() {
  await fs.rm(docsRoot, { recursive: true, force: true })
  await fs.mkdir(docsRoot, { recursive: true })
  await clearConfigFiles()

  const source = await resolveSource(sourceInput)
  if (source.type === "github" && source.repo) {
    await fetchGitHubDocs(source.repo)
  } else {
    await copyLocalDocs(sourceInput)
  }

  const configPath = await findConfigPath()
  const config = configPath ? await readConfig(configPath) : null

  await writeConfigFile(config)
  await writeSourceFiles(source)

  if (source.type === "local") {
    const sourceMap = await buildSourceMapFromLocal()
    await writeSourceMap(sourceMap)
  }

  await writeThemeSource(source, config)
  await writeLlmsFile(config)
}

async function clearConfigFiles() {
  for (const configFile of configFiles) {
    await fs.rm(path.join(contentRoot, configFile), { force: true })
  }
}

async function resolveSource(input: string): Promise<PreparedSource> {
  const isGitHubUrl = /^https?:\/\/(www\.)?github\.com\//i.test(input)
  if (!isGitHubUrl) {
    return { type: "local", source: input }
  }

  const repo = parseGitHubUrl(input)
  if (!repo) {
    throw new Error(`Invalid GitHub URL: ${input}`)
  }

  return { type: "github", source: input, repo }
}

function parseGitHubUrl(url: string): GitHubSource | null {
  const treeMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/?(.*)/)
  if (treeMatch) {
    return {
      owner: treeMatch[1],
      repo: treeMatch[2],
      ref: treeMatch[3],
      docsPath: decodeURIComponent(treeMatch[4] || ""),
    }
  }

  const blobMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/?(.*)/)
  if (blobMatch) {
    const fullPath = decodeURIComponent(blobMatch[4] || "")
    const lastSlash = fullPath.lastIndexOf("/")
    const docsPath = lastSlash > 0 ? fullPath.slice(0, lastSlash) : ""
    return {
      owner: blobMatch[1],
      repo: blobMatch[2],
      ref: blobMatch[3],
      docsPath,
    }
  }

  const repoMatch = url.match(/github\.com\/([^/]+)\/([^/]+)(?:$|\/)/)
  if (repoMatch) {
    return {
      owner: repoMatch[1],
      repo: repoMatch[2],
      ref: "main",
      docsPath: "",
    }
  }

  return null
}

async function copyLocalDocs(input: string) {
  const sourcePath = path.resolve(projectRoot, input)
  const stat = await fs.stat(sourcePath)

  if (stat.isFile()) {
    throw new Error(`GITTYDOCS_SOURCE must be a directory: ${sourcePath}`)
  }

  const files = await collectFiles(sourcePath)
  for (const filePath of files) {
    const relativePath = path.relative(sourcePath, filePath)
    const ext = path.extname(relativePath).toLowerCase()

    if (docsExtensions.has(ext)) {
      const destPath = path.join(docsRoot, relativePath)
      await ensureDir(path.dirname(destPath))
      await fs.copyFile(filePath, destPath)
    }
  }

  for (const configFile of configFiles) {
    const configPath = path.join(sourcePath, configFile)
    if (await exists(configPath)) {
      await ensureDir(contentRoot)
      await fs.copyFile(configPath, path.join(contentRoot, configFile))
      break
    }
  }

  await processStaticFolders(sourcePath)
}

async function processStaticFolders(sourcePath: string) {
  const entries = await fs.readdir(sourcePath, { withFileTypes: true })
  const staticFolderNames = new Set(["[static]", "[images]"])

  for (const entry of entries) {
    if (entry.isDirectory() && staticFolderNames.has(entry.name)) {
      const staticFolderPath = path.join(sourcePath, entry.name)
      await copyStaticFolderContents(staticFolderPath, entry.name)
    }
  }
}

async function copyStaticFolderContents(staticFolderPath: string, folderLabel: string) {
  await ensureDir(publicStaticRoot)

  const files = await collectFiles(staticFolderPath)
  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase()
    if (!staticExtensions.has(ext)) continue

    const relativePath = path.relative(staticFolderPath, filePath)
    const destPath = path.join(publicStaticRoot, relativePath)
    await ensureDir(path.dirname(destPath))
    await fs.copyFile(filePath, destPath)
    console.log(`${logPrefix} ${folderLabel} Copied: ${relativePath}`)
  }
}

async function fetchGitHubDocs(repo: GitHubSource) {
  const entries = await listGitHubEntries(repo, repo.docsPath)
  const sourceMap: Record<string, string> = {}

  for (const entry of entries) {
    if (entry.type === "dir") continue
    const ext = path.extname(entry.path).toLowerCase()
    if (!docsExtensions.has(ext)) continue

    const fileContent = await fetchGitHubFile(entry)
    const relativePath = repo.docsPath
      ? entry.path.replace(new RegExp(`^${escapeRegex(repo.docsPath)}/?`), "")
      : entry.path
    const destPath = path.join(docsRoot, relativePath)
    await ensureDir(path.dirname(destPath))
    await fs.writeFile(destPath, fileContent, "utf-8")

    const routePath = toRoutePath(relativePath)
    sourceMap[routePath] = relativePath.replace(/\\/g, "/")
  }

  await writeSourceMap(sourceMap)
  await fetchGitHubConfig(repo)
  await fetchGitHubStaticFolder(repo)
}

async function fetchGitHubStaticFolder(repo: GitHubSource) {
  const staticFolders = ["[static]", "[images]"]

  for (const folderName of staticFolders) {
    const staticPath = repo.docsPath ? `${repo.docsPath}/${folderName}` : folderName

    try {
      const entries = await listGitHubEntries(repo, staticPath)
      await ensureDir(publicStaticRoot)

      for (const entry of entries) {
        if (entry.type === "dir") continue
        const ext = path.extname(entry.path).toLowerCase()
        if (!staticExtensions.has(ext)) continue

        const fileContent = await fetchGitHubFile(entry)
        const relativePath = entry.path.replace(new RegExp(`^${escapeRegex(staticPath)}/?`), "")
        const destPath = path.join(publicStaticRoot, relativePath)
        await ensureDir(path.dirname(destPath))
        await fs.writeFile(destPath, fileContent)
        console.log(`${logPrefix} ${folderName} Downloaded: ${relativePath}`)
      }
    } catch (error) {
      console.log(`${logPrefix} ${folderName} Skipped (not found or fetch error): ${error}`)
    }
  }
}

async function fetchGitHubConfig(repo: GitHubSource) {
  for (const configFile of configFiles) {
    const filePath = repo.docsPath ? `${repo.docsPath}/${configFile}` : configFile
    const url = `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${repo.ref}/${filePath}`
    const response = await fetch(url, { headers: buildGitHubHeaders() })
    if (!response.ok) continue
    const content = await response.text()
    await ensureDir(contentRoot)
    await fs.writeFile(path.join(contentRoot, configFile), content, "utf-8")
    break
  }
}

async function listGitHubEntries(repo: GitHubSource, docsPath: string) {
  const entries: Array<{ path: string; type: "file" | "dir"; download_url?: string }> = []
  const startPath = docsPath || ""

  async function walk(dir: string) {
    const apiPath = dir ? encodeURI(dir) : ""
    const url = apiPath
      ? `https://api.github.com/repos/${repo.owner}/${repo.repo}/contents/${apiPath}?ref=${repo.ref}`
      : `https://api.github.com/repos/${repo.owner}/${repo.repo}/contents?ref=${repo.ref}`

    const response = await fetch(url, { headers: buildGitHubHeaders() })
    if (!response.ok) {
      throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    if (!Array.isArray(data)) {
      if (data?.type === "file") {
        entries.push({ path: data.path, type: "file", download_url: data.download_url })
      }
      return
    }

    for (const item of data) {
      if (item.type === "dir") {
        await walk(item.path)
      } else if (item.type === "file") {
        entries.push({ path: item.path, type: "file", download_url: item.download_url })
      }
    }
  }

  await walk(startPath)
  return entries
}

async function fetchGitHubFile(entry: { path: string; download_url?: string }) {
  if (!entry.download_url) {
    throw new Error(`Missing download_url for ${entry.path}`)
  }
  const url = entry.download_url
  const response = await fetch(url, { headers: buildGitHubHeaders() })
  if (!response.ok) {
    throw new Error(`Failed to fetch ${entry.path}: ${response.status}`)
  }
  return response.text()
}

async function collectFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath)))
    } else if (entry.isFile()) {
      files.push(fullPath)
    }
  }

  return files
}

async function writeConfigFile(config: DocsConfig | null) {
  const outputPath = path.join(projectRoot, "src", "gittydocs", "lib", "docs", "config.gen.ts")

  const content = `// This file is generated by prepare-docs.ts

export interface GitHubRepo {
  owner: string
  repo: string
  ref: string
  docsPath: string
}

export interface NavItem {
  label: string
  path?: string
  items?: NavItem[]
  accordion?: boolean
}

export interface DocsConfig {
  site: {
    name: string
    description?: string
    logo?: string
    favicon?: string
    socialBanner?: string
    repo?: GitHubRepo
  }
  nav?: NavItem[]
  links?: {
    github?: string
    issues?: string
  }
  theme?: {
    preset?: string
    cssFile?: string
  }
  llms?: {
    enabled?: boolean
    path?: string
  }
}

export const gittydocsConfig: DocsConfig | null = ${JSON.stringify(config, null, 2)}
`

  await ensureDir(path.dirname(outputPath))
  await fs.writeFile(outputPath, content, "utf-8")
}

async function findConfigPath(): Promise<string | null> {
  for (const configFile of configFiles) {
    const candidate = path.join(contentRoot, configFile)
    if (await exists(candidate)) return candidate
  }
  return null
}

async function readConfig(filePath: string) {
  const raw = await fs.readFile(filePath, "utf-8")
  const parsed = parse(raw)
  if (!parsed || typeof parsed !== "object") return null
  return parsed
}

async function writeThemeSource(source: PreparedSource, config: DocsConfig | null) {
  const themeFile = resolveThemeFile(config)
  if (!themeFile) {
    await writeThemeSourceFile(null)
    return
  }

  const normalizedFile = themeFile.replace(/^\/+/, "")
  const outputPath = path.join(publicStaticRoot, normalizedFile)
  const themeExists =
    source.type === "github"
      ? await fetchThemeFromGitHub(source, normalizedFile, outputPath)
      : await copyThemeFromLocal(source, normalizedFile, outputPath)

  if (!themeExists) {
    await writeThemeSourceFile(null)
    return
  }

  await writeThemeSourceFile(`/static/${normalizedFile.replace(/\\/g, "/")}`)
}

async function writeLlmsFile(config: DocsConfig | null) {
  const enabled = config?.llms?.enabled !== false
  const outputPath = path.join(projectRoot, "public", "llms.txt")
  const llmsDir = normalizeLlmsDir(config?.llms?.path)
  const llmsDirPath = path.join(projectRoot, "public", llmsDir)

  if (!enabled) {
    await fs.rm(outputPath, { force: true })
    await fs.rm(llmsDirPath, { recursive: true, force: true })
    return
  }

  const pages = await collectDocsPages()
  const titleByRoute = new Map(pages.map((page) => [page.routePath, page.title]))
  seedLlmsMaps(pages, llmsDir)
  const nav = buildNavForLlms(pages, titleByRoute, config?.nav as NavItem[] | undefined)
  const llmsContent = renderLlmsTxt(nav, config, llmsDir)
  const withBom = `\uFEFF${llmsContent}`

  await ensureDir(path.dirname(outputPath))
  await fs.writeFile(outputPath, withBom, "utf-8")
  await writeLlmsSubpages(pages, llmsDir)
}

function resolveThemeFile(config: DocsConfig | null) {
  const cssFile = config?.theme?.cssFile
  if (cssFile && typeof cssFile === "string") return cssFile
  return "theme.css"
}

async function copyThemeFromLocal(
  source: PreparedSource,
  themeFile: string,
  outputPath: string
): Promise<boolean> {
  const sourcePath = path.resolve(projectRoot, source.source)
  const themePath = path.join(sourcePath, themeFile)
  if (!(await exists(themePath))) return false
  await ensureDir(path.dirname(outputPath))
  await fs.copyFile(themePath, outputPath)
  return true
}

async function fetchThemeFromGitHub(
  source: PreparedSource,
  themeFile: string,
  outputPath: string
): Promise<boolean> {
  if (!source.repo) return false
  const filePath = source.repo.docsPath ? `${source.repo.docsPath}/${themeFile}` : themeFile
  const url = `https://raw.githubusercontent.com/${source.repo.owner}/${source.repo.repo}/${source.repo.ref}/${filePath}`
  const response = await fetch(url, { headers: buildGitHubHeaders() })
  if (!response.ok) return false
  const content = await response.text()
  await ensureDir(path.dirname(outputPath))
  await fs.writeFile(outputPath, content, "utf-8")
  return true
}

async function writeThemeSourceFile(themeCssHref: string | null) {
  const outputPath = path.join(
    projectRoot,
    "src",
    "gittydocs",
    "lib",
    "themes",
    "theme-source.gen.ts"
  )
  const content = `// This file is generated by prepare-docs.ts

export const themeCssHref: string | null = ${themeCssHref ? JSON.stringify(themeCssHref) : "null"}
`
  await ensureDir(path.dirname(outputPath))
  await fs.writeFile(outputPath, content, "utf-8")
}

async function buildSourceMapFromLocal() {
  const files = await collectFiles(docsRoot)
  const sourceMap: Record<string, string> = {}

  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase()
    if (!docsExtensions.has(ext)) continue
    const relativePath = path.relative(docsRoot, filePath).replace(/\\/g, "/")
    const routePath = toRoutePath(relativePath)
    sourceMap[routePath] = relativePath
  }

  return sourceMap
}

async function writeSourceFiles(source: PreparedSource) {
  const outputPath = path.join(projectRoot, "src", "gittydocs", "lib", "docs", "source.gen.ts")
  const content = `export const gittydocsSource = ${JSON.stringify(source, null, 2)} as const

export type GittydocsSource = typeof gittydocsSource
`

  await ensureDir(path.dirname(outputPath))
  await fs.writeFile(outputPath, content, "utf-8")
}

async function writeSourceMap(sourceMap: Record<string, string>) {
  const outputPath = path.join(projectRoot, "src", "gittydocs", "lib", "docs", "source-map.gen.ts")
  const content = `export const sourcePathByRoute: Record<string, string> = ${JSON.stringify(
    sourceMap,
    null,
    2
  )}
`

  await ensureDir(path.dirname(outputPath))
  await fs.writeFile(outputPath, content, "utf-8")
}

interface LlmsPage {
  routePath: string
  sourcePath: string
  title: string
  description?: string
  body: string
}

async function collectDocsPages(): Promise<LlmsPage[]> {
  const files = await collectFiles(docsRoot)
  const pages: LlmsPage[] = []

  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase()
    if (!docsExtensions.has(ext)) continue

    const relativePath = path.relative(docsRoot, filePath).replace(/\\/g, "/")
    const routePath = toRoutePath(relativePath)
    const raw = await fs.readFile(filePath, "utf-8")
    const title = extractFrontmatterField(raw, "title") || defaultLabel(path.basename(relativePath))
    const description = extractFrontmatterField(raw, "description") || undefined
    const body = stripFrontmatter(raw)

    pages.push({ routePath, sourcePath: relativePath, title, description, body })
  }

  return pages
}

function stripFrontmatter(content: string): string {
  if (!content.startsWith("---")) return content
  const endIndex = content.indexOf("\n---", 3)
  if (endIndex === -1) return content
  const body = content.slice(endIndex + 4)
  return body.replace(/^\s+/, "")
}

function extractFrontmatterField(content: string, field: string): string | null {
  if (!content.startsWith("---")) return null
  const endIndex = content.indexOf("\n---", 3)
  if (endIndex === -1) return null

  const frontmatter = content.slice(3, endIndex)
  const pattern = new RegExp(`(^|\\n)\\s*${escapeRegex(field)}\\s*:\\s*(.+)\\s*$`, "m")
  const match = frontmatter.match(pattern)
  if (!match) return null

  let value = match[2].trim()
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1)
  }

  return value || null
}

function buildNavForLlms(
  pages: LlmsPage[],
  titleByRoute: Map<string, string>,
  configNav?: NavItem[]
): NavItem[] {
  if (configNav && configNav.length > 0) {
    return configNav
  }

  const tree = buildFileTree(pages.map((p) => p.sourcePath))
  return buildNavFromTree(tree, titleByRoute)
}

interface FileNode {
  name: string
  path: string
  type: "file" | "directory"
  children?: FileNode[]
}

function buildFileTree(paths: string[]): FileNode[] {
  const root: FileNode = { name: "", path: "", type: "directory", children: [] }

  for (const filePath of paths) {
    const parts = filePath.split("/").filter(Boolean)
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isFile = i === parts.length - 1
      if (!current.children) current.children = []

      let next = current.children.find((child) => child.name === part)
      if (!next) {
        next = {
          name: part,
          path: current.path ? `${current.path}/${part}` : part,
          type: isFile ? "file" : "directory",
          children: isFile ? undefined : [],
        }
        current.children.push(next)
      }

      current = next
    }
  }

  return root.children || []
}

function buildNavFromTree(tree: FileNode[], titleByRoute: Map<string, string>): NavItem[] {
  const nav: NavItem[] = []

  const sorted = [...tree].sort((a, b) => {
    const aIsIndex = a.name.startsWith("index.")
    const bIsIndex = b.name.startsWith("index.")

    if (aIsIndex && !bIsIndex) return -1
    if (!aIsIndex && bIsIndex) return 1

    const aNum = a.name.match(/^(\d+)-/)
    const bNum = b.name.match(/^(\d+)-/)

    if (aNum && bNum) return parseInt(aNum[1], 10) - parseInt(bNum[1], 10)
    if (aNum) return -1
    if (bNum) return 1

    return a.name.localeCompare(b.name)
  })

  for (const node of sorted) {
    if (node.type === "directory" && node.children) {
      const children = buildNavFromTree(node.children, titleByRoute)
      if (children.length > 0) {
        nav.push({
          label: formatLabel(node.name),
          items: children,
        })
      }
      continue
    }

    if (node.type === "file") {
      const routePath = toRoutePath(node.path.replace(/\.(md|mdx)$/i, ""))
      const label = titleByRoute.get(routePath) || defaultLabel(node.name)
      nav.push({ label, path: routePath })
    }
  }

  return nav
}

function defaultLabel(name: string): string {
  if (name.startsWith("index.")) return "Overview"
  return formatLabel(name.replace(/\.(md|mdx)$/i, ""))
}

function formatLabel(name: string): string {
  const cleanName = name.replace(/^\d+-/, "")
  return cleanName
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function renderLlmsTxt(nav: NavItem[], config: DocsConfig | null, llmsDir: string): string {
  const lines: string[] = []
  const siteName = config?.site?.name || "Documentation"
  const siteDescription = config?.site?.description

  lines.push(`# ${siteName}`)
  if (siteDescription) {
    lines.push("")
    lines.push(`> ${siteDescription}`)
  }
  lines.push("")
  lines.push(`Paths are site-relative. Use {origin}{path}, not /llms.txt{path}.`)
  lines.push(`Per-page markdown lives at /${llmsDir}/... by default.`)
  lines.push("")
  lines.push("## Table of Contents")
  lines.push("")

  const standalone: NavItem[] = []
  const sections: NavItem[] = []

  for (const item of nav) {
    if (item.items && item.items.length > 0) {
      sections.push(item)
    } else if (item.path) {
      standalone.push(item)
    }
  }

  if (standalone.length > 0) {
    lines.push("### Pages")
    lines.push(...renderNavItems(standalone))
    lines.push("")
  }

  for (const section of sections) {
    lines.push(`### ${section.label}`)
    if (section.items) {
      lines.push(...renderNavItems(section.items))
    }
    lines.push("")
  }

  return lines.join("\n").trimEnd() + "\n"
}

function renderNavItems(items: NavItem[]): string[] {
  const lines: string[] = []

  for (const item of items) {
    if (item.items && item.items.length > 0) {
      for (const child of item.items) {
        const normalizedPath = normalizeLlmsPath(child.path)
        if (!normalizedPath || normalizedPath === "/llms.txt") continue
        lines.push(renderNavLine(normalizedPath, child.label))
      }
      continue
    }

    const normalizedPath = normalizeLlmsPath(item.path)
    if (!normalizedPath || normalizedPath === "/llms.txt") continue
    lines.push(renderNavLine(normalizedPath, item.label))
  }

  return lines
}

function seedLlmsMaps(pages: LlmsPage[], llmsDir: string) {
  llmsTitleByRoute.clear()
  llmsDescriptionByRoute.clear()
  llmsPathByRoute.clear()
  for (const page of pages) {
    llmsTitleByRoute.set(page.routePath, page.title)
    if (page.description) {
      llmsDescriptionByRoute.set(page.routePath, page.description)
    }
    llmsPathByRoute.set(page.routePath, buildLlmsPath(page, llmsDir))
  }
}

function renderNavLine(pathValue: string, fallbackLabel: string): string {
  const resolvedPath = resolveLlmsPath(pathValue)
  const label = llmsTitleByRoute.get(pathValue) || fallbackLabel || pathValue
  const description = llmsDescriptionByRoute.get(pathValue)
  if (description) {
    return `- [${label}](${resolvedPath}): ${description}`
  }
  return `- [${label}](${resolvedPath})`
}

function resolveLlmsPath(pathValue: string): string {
  if (/^https?:\/\//i.test(pathValue)) return pathValue
  return llmsPathByRoute.get(pathValue) || pathValue
}

function normalizeLlmsPath(pathValue?: string): string | null {
  if (!pathValue) return null
  if (/^https?:\/\//i.test(pathValue)) return pathValue
  return pathValue.startsWith("/") ? pathValue : `/${pathValue}`
}

function normalizeLlmsDir(value?: string): string {
  const raw = (value || "llms").trim().replace(/^\/+|\/+$/g, "")
  return raw.length > 0 ? raw : "llms"
}

function buildLlmsPath(page: LlmsPage, llmsDir: string): string {
  const relative = page.sourcePath.replace(/\.(md|mdx)$/i, ".md").replace(/^\/+/, "")
  return `/${llmsDir}/${relative}`
}

async function writeLlmsSubpages(pages: LlmsPage[], llmsDir: string) {
  const outputRoot = path.join(projectRoot, "public", llmsDir)
  await fs.rm(outputRoot, { recursive: true, force: true })
  for (const page of pages) {
    const outputPath = path.join(outputRoot, page.sourcePath.replace(/\.(md|mdx)$/i, ".md"))
    await ensureDir(path.dirname(outputPath))
    const content = `\uFEFF${renderLlmsPage(page)}`
    await fs.writeFile(outputPath, content, "utf-8")
  }
}

function renderLlmsPage(page: LlmsPage): string {
  const body = page.body.trim()

  if (body.startsWith("#")) {
    const endOfHeading = body.indexOf("\n")
    const headingLine = endOfHeading === -1 ? body : body.slice(0, endOfHeading)
    const rest = endOfHeading === -1 ? "" : body.slice(endOfHeading + 1).trimStart()
    const lines: string[] = [headingLine]

    if (page.description) {
      lines.push("")
      lines.push(`> ${page.description}`)
    }
    if (rest) {
      lines.push("")
      lines.push(rest)
    }
    return lines.join("\n").trimEnd() + "\n"
  }

  const lines: string[] = [`# ${page.title}`]
  if (page.description) {
    lines.push("")
    lines.push(`> ${page.description}`)
  }
  if (body) {
    lines.push("")
    lines.push(body)
  }
  return lines.join("\n").trimEnd() + "\n"
}

function toRoutePath(relativePath: string) {
  let route = relativePath.replace(/\\/g, "/").replace(/\.(md|mdx)$/i, "")
  if (route.endsWith("/index") || route === "index") {
    route = route.replace(/\/?index$/, "") || "/"
  }
  if (route.endsWith("/readme") || route.toLowerCase() === "readme") {
    route = route.replace(/\/?readme$/, "") || "/"
  }
  return route.startsWith("/") ? route : `/${route}`
}

function buildGitHubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "gittydocs",
  }
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`
  }
  return headers
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}

async function exists(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}
