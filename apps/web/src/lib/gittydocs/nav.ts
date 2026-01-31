import type { FileNode, NavItem } from "./types"

export function buildNavFromPaths(
  sourcePaths: string[],
  titleByRoute: Record<string, string>
): NavItem[] {
  const tree = buildFileTree(sourcePaths)
  return buildNavFromTree(tree, titleByRoute)
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

function buildNavFromTree(tree: FileNode[], titleByRoute: Record<string, string>): NavItem[] {
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
      const routePath = getRoutePath(node.path)
      const label = titleByRoute[routePath] || defaultLabel(node.name)
      nav.push({ label, path: routePath })
    }
  }

  return nav
}

function getRoutePath(filePath: string): string {
  let route = filePath.replace(/\.(md|mdx)$/i, "")
  if (route.endsWith("/index") || route === "index") {
    route = route.replace(/\/?index$/, "") || "/"
  }
  if (route.endsWith("/readme") || route.toLowerCase() === "readme") {
    route = route.replace(/\/?readme$/, "") || "/"
  }
  return route.startsWith("/") ? route : `/${route}`
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
