export interface SourceRepository {
  owner: string
  name: string
  ref?: string
  docsPath?: string
}

export interface PreparedDocsSource {
  type: "local" | "github"
  repo?: { owner: string; repo: string; ref: string; docsPath: string }
}

/** Explicit source configuration wins; a fetched GitHub source also works without config. */
export function resolveSourceRepository(
  configured?: SourceRepository | null,
  source?: PreparedDocsSource | null
): SourceRepository | null {
  if (configured) return configured
  if (source?.type !== "github" || !source.repo) return null
  return { ...source.repo, name: source.repo.repo }
}

function normalizePath(value: string): string | null {
  const path = value.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "")
  const segments = path.split("/")
  if (segments.some((segment) => segment === "." || segment === ".." || !segment)) return null
  return path
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/")
}

/** sourcePath is docs-relative, as provided by sourcePathByRoute (not Velite's collection path). */
export function buildSourceUrl(
  repo: SourceRepository | null | undefined,
  sourcePath: string | null | undefined
): string | null {
  if (!repo?.owner || !repo.name || !sourcePath) return null
  const source = normalizePath(sourcePath)
  if (!source || !/\.(md|mdx)$/i.test(source)) return null
  const docsPath = repo.docsPath === "" ? "" : normalizePath(repo.docsPath ?? "docs")
  if (docsPath === null) return null
  const path = docsPath ? `${docsPath}/${source}` : source
  // A ref is a single URL component, even for branches named feature/something.
  return `https://github.com/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/blob/${encodeURIComponent(repo.ref || "main")}/${encodePath(path)}`
}

/** Matches prepare-docs: nested indexes/README files keep their real source filenames. */
export function buildMarkdownUrl(options: {
  sourcePath?: string | null
  llms?: { enabled?: boolean; path?: string } | null
  basePath?: string
}): string | null {
  if (options.llms?.enabled === false || !options.sourcePath) return null
  const source = normalizePath(options.sourcePath)
  if (!source || !/\.(md|mdx)$/i.test(source)) return null
  const directory = (options.llms?.path || "llms").trim().replace(/^\/+|\/+$/g, "") || "llms"
  const normalizedDirectory = normalizePath(directory)
  if (!normalizedDirectory) return null
  const base = (options.basePath ?? "/").replace(/\/+$/, "")
  return `${base}/${encodePath(normalizedDirectory)}/${encodePath(source.replace(/\.(md|mdx)$/i, ".md"))}`
}
