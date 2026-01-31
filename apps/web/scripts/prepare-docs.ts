import fs from "fs/promises"
import path from "path"
import { parse } from "jsonc-parser"

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

const projectRoot = process.cwd()
const contentRoot = path.join(projectRoot, "content")
const docsRoot = path.join(contentRoot, "docs")
const sourceInput = process.env.GITTYDOCS_SOURCE || "../../docs"
const githubToken = process.env.GITHUB_TOKEN

const docsExtensions = new Set([".md", ".mdx"])
const configFiles = ["gittydocs.jsonc", "gittydocs.json"]

await prepareDocs()

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

  await writeConfigFile(source)
  await writeSourceFiles(source)
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
    if (!docsExtensions.has(ext)) continue
    const destPath = path.join(docsRoot, relativePath)
    await ensureDir(path.dirname(destPath))
    await fs.copyFile(filePath, destPath)
  }

  for (const configFile of configFiles) {
    const configPath = path.join(sourcePath, configFile)
    if (await exists(configPath)) {
      await ensureDir(contentRoot)
      await fs.copyFile(configPath, path.join(contentRoot, configFile))
      break
    }
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
      ? entry.path.replace(new RegExp(`^${escapeRegex(repo.docsPath)}\/?`), "")
      : entry.path
    const destPath = path.join(docsRoot, relativePath)
    await ensureDir(path.dirname(destPath))
    await fs.writeFile(destPath, fileContent, "utf-8")

    const routePath = toRoutePath(relativePath)
    sourceMap[routePath] = relativePath.replace(/\\/g, "/")
  }

  await writeSourceMap(sourceMap)
  await fetchGitHubConfig(repo)
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

async function writeConfigFile(source: PreparedSource) {
  const configPath = await findConfigPath()
  const outputPath = path.join(projectRoot, "src", "lib", "docs", "config.gen.ts")
  const config = configPath ? await readConfig(configPath) : null

  const content = `import type { DocsConfig } from "@/lib/gittydocs/types"

export const gittydocsConfig: DocsConfig | null = ${JSON.stringify(config, null, 2)}
`

  await ensureDir(path.dirname(outputPath))
  await fs.writeFile(outputPath, content, "utf-8")

  if (source.type === "local") {
    const sourceMap = await buildSourceMapFromLocal()
    await writeSourceMap(sourceMap)
  }
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
  const outputPath = path.join(projectRoot, "src", "lib", "docs", "source.gen.ts")
  const content = `export const gittydocsSource = ${JSON.stringify(source, null, 2)} as const

export type GittydocsSource = typeof gittydocsSource
`

  await ensureDir(path.dirname(outputPath))
  await fs.writeFile(outputPath, content, "utf-8")
}

async function writeSourceMap(sourceMap: Record<string, string>) {
  const outputPath = path.join(projectRoot, "src", "lib", "docs", "source-map.gen.ts")
  const content = `export const sourcePathByRoute: Record<string, string> = ${JSON.stringify(
    sourceMap,
    null,
    2
  )}
`

  await ensureDir(path.dirname(outputPath))
  await fs.writeFile(outputPath, content, "utf-8")
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
