import fs from "node:fs/promises"
import path from "node:path"
import { type SiteVersion, siteVersionSchema } from "../../src/gittydocs/lib/config-schema"

export type VersionSource =
  | { type: "local"; docsDir: string }
  | {
      type: "github"
      owner: string
      repo: string
      ref: string
      docsPath: string
      headers?: Record<string, string>
    }

export interface VersionResolutionOptions {
  fetch?: typeof fetch
  /** Includes missing Cargo ancestor candidates, so a newly created workspace can be watched. */
  onManifest?: (manifestPath: string) => void
}

export interface ResolvedVersion {
  version: string | undefined
  /** Absolute local paths, or repo-relative GitHub paths. Not part of runtime config. */
  manifestPaths: string[]
}

/** Resolve against the original source, not the copied config in the web runtime cache. */
export async function resolveSiteVersion(
  input: SiteVersion | undefined,
  source: VersionSource,
  options: VersionResolutionOptions = {}
): Promise<ResolvedVersion> {
  const manifestPaths = new Set<string>()
  const track = (manifestPath: string) => {
    manifestPaths.add(manifestPath)
    options.onManifest?.(manifestPath)
  }
  if (input === undefined) return { version: undefined, manifestPaths: [] }
  const validated = siteVersionSchema.safeParse(input)
  if (!validated.success) {
    throw new Error(
      'Invalid site.version: use a nonempty string, { packageJson: "../package.json" }, or { cargoToml: "../Cargo.toml" }.'
    )
  }
  const versionInput = validated.data
  if (typeof versionInput === "string") return { version: versionInput, manifestPaths: [] }

  const kind = "packageJson" in versionInput ? "packageJson" : "cargoToml"
  const reference =
    "packageJson" in versionInput ? versionInput.packageJson : versionInput.cargoToml
  const filename = kind === "packageJson" ? "package.json" : "Cargo.toml"
  const manifestPath = resolveManifestPath(source, reference)
  const paths = source.type === "local" ? path : path.posix
  if (paths.basename(manifestPath) !== filename) {
    throw new Error(
      `Invalid site.version.${kind} path "${reference}": point to a ${filename} file.`
    )
  }

  const read = async (filePath: string, optional = false): Promise<string | null> => {
    track(filePath)
    if (source.type === "local") {
      try {
        return await fs.readFile(filePath, "utf-8")
      } catch (error) {
        if (optional && (error as NodeJS.ErrnoException).code === "ENOENT") return null
        throw new Error(
          `Cannot read site.version manifest ${filePath}: ${String(error)}. Check the path relative to the original docs/config folder and file permissions.`
        )
      }
    }
    const encodedPath = filePath.split("/").map(encodeURIComponent).join("/")
    const url = `https://raw.githubusercontent.com/${encodeURIComponent(source.owner)}/${encodeURIComponent(source.repo)}/${encodeURIComponent(source.ref)}/${encodedPath}`
    let response: Response
    try {
      response = await (options.fetch ?? fetch)(url, { headers: source.headers })
    } catch (error) {
      throw new Error(
        `Cannot fetch site.version manifest ${filePath} at ref ${source.ref}: ${String(error)}.`
      )
    }
    if (optional && response.status === 404) return null
    if (!response.ok) {
      throw new Error(
        `Cannot fetch site.version manifest ${filePath} at ref ${source.ref}: HTTP ${response.status}. Check the path relative to docsPath, the GitHub ref, and repository access.`
      )
    }
    return response.text()
  }

  const raw = await read(manifestPath)
  let version: string
  if (kind === "packageJson") {
    let json: unknown
    try {
      json = JSON.parse(raw!)
    } catch (error) {
      throw new Error(`Invalid JSON in site.version manifest ${manifestPath}: ${String(error)}.`)
    }
    version = requireVersion(asObject(json)?.version, manifestPath, "top-level version")
  } else {
    const cargo = parseCargo(raw!, manifestPath)
    const pkg = asObject(cargo.package)
    if (typeof pkg?.version === "string") {
      version = requireVersion(pkg.version, manifestPath, "[package].version")
    } else if (asObject(pkg?.version)?.workspace === true) {
      let workspacePath = manifestPath
      let workspace = asObject(cargo.workspace)
      if (pkg?.workspace !== undefined) {
        if (typeof pkg.workspace !== "string" || !pkg.workspace.trim()) {
          throw new Error(
            `Invalid [package].workspace in ${manifestPath}: expected a nonempty directory path.`
          )
        }
        workspacePath = resolveManifestPath(
          source,
          `${pkg.workspace}/Cargo.toml`,
          paths.dirname(manifestPath)
        )
        workspace = asObject(parseCargo((await read(workspacePath))!, workspacePath).workspace)
      } else if (!workspace) {
        let dir = paths.dirname(manifestPath)
        while (true) {
          const parent = paths.dirname(dir)
          if (parent === dir) break
          dir = parent
          workspacePath = paths.join(dir, "Cargo.toml")
          const candidate = await read(workspacePath, true)
          if (candidate !== null)
            workspace = asObject(parseCargo(candidate, workspacePath).workspace)
          if (workspace) break
        }
      }
      if (!workspace) {
        throw new Error(
          `Cannot resolve [package].version.workspace = true in ${manifestPath}: no workspace Cargo.toml found. Set [workspace.package].version in an ancestor or set [package].workspace to its directory.`
        )
      }
      version = requireVersion(
        asObject(workspace.package)?.version,
        workspacePath,
        "[workspace.package].version"
      )
    } else {
      throw new Error(
        `Missing or invalid [package].version in ${manifestPath}: expected a nonempty string or version.workspace = true with [workspace.package].version.`
      )
    }
  }
  return { version, manifestPaths: [...manifestPaths] }
}

function resolveManifestPath(source: VersionSource, reference: string, baseDir?: string): string {
  if (!reference.trim() || reference.includes("\0") || /^[a-z][a-z\d+.-]*:\/\//i.test(reference)) {
    throw new Error(
      `Invalid site.version manifest path "${reference}": expected a local manifest file path.`
    )
  }
  if (source.type === "local") return path.resolve(baseDir ?? source.docsDir, reference)
  if (reference.startsWith("/") || reference.includes("\\") || /^[a-z]:/i.test(reference)) {
    throw new Error(
      `Invalid site.version manifest path "${reference}": GitHub paths must be relative to docsPath and stay inside the repository.`
    )
  }
  const resolved = path.posix.normalize(path.posix.join(baseDir ?? source.docsPath, reference))
  if (resolved === ".." || resolved.startsWith("../") || resolved.startsWith("/")) {
    throw new Error(
      `Invalid site.version manifest path "${reference}": path escapes the GitHub repository root.`
    )
  }
  return resolved
}

function parseCargo(raw: string, manifestPath: string): Record<string, unknown> {
  try {
    return Bun.TOML.parse(raw) as Record<string, unknown>
  } catch (error) {
    throw new Error(
      `Invalid TOML in site.version manifest ${manifestPath}: ${String(error)}. Fix the Cargo.toml syntax.`
    )
  }
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function requireVersion(value: unknown, manifestPath: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(
      `Missing or invalid ${field} in site.version manifest ${manifestPath}: expected a nonempty string.`
    )
  }
  return value.trim()
}
