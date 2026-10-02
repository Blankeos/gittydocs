import type { NavItem } from "./config-schema"

/** Velite source paths include one collection prefix; custom-page paths do not. */
export function normalizeMdxSourcePath(sourcePath: string): string {
  return sourcePath.replace(/^docs\//, "")
}

interface NavPage {
  sourcePath: string
  routePath: string
  title: string
}

interface FileNode {
  name: string
  path: string
  type: "file" | "directory"
  children?: FileNode[]
}

/** Build automatic navigation from collection-relative paths and known page routes. */
export function buildNavFromPages(pages: NavPage[], configNav?: NavItem[]): NavItem[] {
  if (configNav && configNav.length > 0) return configNav

  const root: FileNode = { name: "", path: "", type: "directory", children: [] }
  const pagesBySource = new Map<string, NavPage>()
  for (const page of pages) {
    const parts = page.sourcePath.split("/").filter(Boolean)
    pagesBySource.set(parts.join("/"), page)
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

  const visit = (tree: FileNode[]): NavItem[] => {
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
        const children = visit(node.children)
        if (children.length > 0) nav.push({ label: formatLabel(node.name), items: children })
      } else {
        const page = pagesBySource.get(node.path)
        if (page) nav.push({ label: page.title || defaultLabel(node.name), path: page.routePath })
      }
    }
    return nav
  }
  return visit(root.children ?? [])
}

export function defaultLabel(name: string): string {
  if (name.startsWith("index.")) return "Overview"
  return formatLabel(name.replace(/\.(md|mdx|tsx|jsx)$/i, ""))
}

function formatLabel(name: string): string {
  return name
    .replace(/^\d+-/, "")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

/** Versions are presented consistently without duplicating an author's prefix. */
export function formatVersionLabel(version: string): string {
  return /^v/i.test(version) ? version : `v${version}`
}

/** HTTP(S) and protocol-relative links must never be passed to the app router. */
export function isExternalHref(path: string): boolean {
  return /^(?:https?:\/\/|\/\/)/i.test(path.trim())
}

/**
 * Allow document routes, fragments/queries, HTTP(S), protocol-relative URLs,
 * mailto and tel links. Reject other schemes, backslashes and control characters
 * (including percent-encoded/nested encodings) before the browser normalizes them.
 * Ordinary surrounding whitespace is trimmed only for validation. Callers should
 * hide unsafe items, not replace their href with a misleading fragment link.
 */
export function isSafeNavHref(path: string): boolean {
  const hasControls = (value: string) =>
    Array.from(value).some((character) => {
      const code = character.charCodeAt(0)
      return code <= 0x1f || (code >= 0x7f && code <= 0x9f)
    })
  if (hasControls(path)) return false
  const href = path.trim()
  if (!href) return false

  // Decode escapes for validation only, without rewriting the author's href.
  // Each pass shortens the string, so nested %25 encodings cannot bypass checks.
  let decoded = href
  while (true) {
    const next = decoded.replace(/(?:%[\da-f]{2})+/gi, (encoded) => {
      try {
        return decodeURIComponent(encoded)
      } catch {
        // Still reject escaped controls/schemes alongside malformed UTF-8.
        return encoded.replace(/%([\da-f]{2})/gi, (sequence, hex: string) => {
          const code = parseInt(hex, 16)
          return code <= 0x9f ? String.fromCharCode(code) : sequence
        })
      }
    })
    if (next === decoded) break
    decoded = next
  }
  if (hasControls(decoded) || decoded.includes("\\")) return false

  const allowed = (value: string): boolean => {
    if (/^(?:https?:\/\/|\/\/)/i.test(value)) {
      try {
        const url = new URL(value, "https://gittydocs.invalid")
        return (url.protocol === "http:" || url.protocol === "https:") && !!url.hostname
      } catch {
        return false
      }
    }
    if (/^(?:mailto|tel):/i.test(value)) return !!value.slice(value.indexOf(":") + 1).trim()
    // A colon in the first relative segment denotes a scheme, not a route.
    return !/^[^/?#]*:/.test(value)
  }
  return allowed(href) && allowed(decoded.trim())
}

/** A document route, rather than a URL scheme, fragment, or query-only link. */
export function isInternalHref(path: string): boolean {
  const href = path.trim()
  return (
    href.length > 0 &&
    !isExternalHref(href) &&
    !/^[a-z][a-z\d+.-]*:/i.test(href) &&
    !/^[?#\\]/.test(href) &&
    !href.startsWith("/\\")
  )
}

export function opensInNewTab(item: NavItem): boolean {
  return item.newTab ?? (item.path ? isExternalHref(item.path) : false)
}

/** Pathless groups navigate to their first real internal descendant page. */
export function resolveNavPagePath(
  item: NavItem,
  pageRoutes: readonly string[],
  basePath = "/"
): string | undefined {
  const known = new Set(pageRoutes.map((route) => normalizeNavPath(route, basePath)))
  const visit = (entry: NavItem): string | undefined => {
    if (entry.path) {
      const path = entry.path.trim()
      const route = normalizeNavPath(path, basePath)
      if (isSafeNavHref(path) && isInternalHref(path) && route !== "/llms.txt" && known.has(route))
        return path
      return undefined
    }
    for (const child of entry.items ?? []) {
      const path = visit(child)
      if (path) return path
    }
    return undefined
  }
  return visit(item)
}

/**
 * Normalize document routes for comparison, without interpreting external URLs
 * as routes. The optional deployment base is stripped at a segment boundary.
 * Query strings and fragments do not change a document's navigation identity.
 */
export function normalizeNavPath(path: string, basePath = "/"): string {
  const href = path.trim()
  if (!href) return "/"
  if (!isInternalHref(href)) return href

  const route = href.split(/[?#]/, 1)[0]
  let normalized = `/${route.replace(/^\/+|\/+$/g, "")}`
  const base = `/${basePath.trim().replace(/^\/+|\/+$/g, "")}`

  if (base !== "/") {
    if (normalized === base) return "/"
    if (normalized.startsWith(`${base}/`)) normalized = normalized.slice(base.length)
  }

  return normalized
}

/**
 * Return the first exact internal route match with all of its ancestors.
 * Items retain their original identity; labels are never used as branch keys.
 * Callers may supply a deployment base when matching a browser pathname.
 */
export function findNavTrail(nav: NavItem[], path: string, basePath = "/"): NavItem[] {
  if (!isInternalHref(path) || !isSafeNavHref(path)) return []
  const route = normalizeNavPath(path, basePath)

  const visit = (items: NavItem[]): NavItem[] => {
    for (const item of items) {
      if (
        item.path &&
        isInternalHref(item.path) &&
        isSafeNavHref(item.path) &&
        normalizeNavPath(item.path, basePath) === route
      ) {
        return [item]
      }
      if (item.items) {
        const trail = visit(item.items)
        if (trail.length > 0) return [item, ...trail]
      }
    }
    return []
  }

  return visit(nav)
}

/** Pre-order traversal, including pathless groups and clickable group landings. */
export function flattenNav(nav: NavItem[]): NavItem[] {
  const flattened: NavItem[] = []
  const visit = (items: NavItem[]) => {
    for (const item of items) {
      flattened.push(item)
      if (item.items) visit(item.items)
    }
  }
  visit(nav)
  return flattened
}
