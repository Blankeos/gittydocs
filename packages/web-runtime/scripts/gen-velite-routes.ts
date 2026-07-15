import fs from "fs"
import path from "path"

interface DocEntry {
  slugAsParams: string
}

const docsPath = path.join(".velite", "docs.json")
const docs: DocEntry[] = JSON.parse(fs.readFileSync(docsPath, "utf-8"))

const routes = docs.map((doc) => toRoutePath(doc.slugAsParams))
const customRoutes = collectCustomPageRoutes(path.join("content", "docs"))
const uniqueRoutes = Array.from(new Set(["/", ...routes, ...customRoutes])).sort()

const outputFile = path.join("src", "velite-route.gen.ts")
const outputContent = `export const veliteRoutes = ${JSON.stringify(uniqueRoutes, null, 2)} as const

export type VeliteRoute = typeof veliteRoutes[number]
`

fs.writeFileSync(outputFile, outputContent, "utf-8")
console.log(`[ROUTES] Generated ${uniqueRoutes.length} static routes`)

function collectCustomPageRoutes(root: string): string[] {
  if (!fs.existsSync(root)) return []

  const routes: string[] = []
  walk(root)

  return routes

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
        continue
      }
      if (!entry.isFile()) continue
      const ext = path.extname(entry.name).toLowerCase()
      if (ext !== ".tsx" && ext !== ".jsx") continue
      const relativePath = path.relative(root, fullPath).replace(/\\/g, "/")
      if (isPrivateSourcePath(relativePath)) continue
      routes.push(toRoutePath(relativePath.replace(/\.(tsx|jsx)$/i, "")))
    }
  }
}

function isPrivateSourcePath(relativePath: string) {
  return relativePath.split("/").some((segment) => segment.startsWith("_"))
}

function toRoutePath(slug: string) {
  let route = slug.replace(/^\/?/, "")
  if (route.endsWith("/index") || route === "index") {
    route = route.replace(/\/?index$/, "") || "/"
  }
  if (route.endsWith("/readme") || route.toLowerCase() === "readme") {
    route = route.replace(/\/?readme$/, "") || "/"
  }
  return route.startsWith("/") ? route : `/${route}`
}
