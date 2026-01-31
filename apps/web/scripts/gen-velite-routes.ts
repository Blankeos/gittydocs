import fs from "fs"
import path from "path"

interface DocEntry {
  slugAsParams: string
}

const docsPath = path.join(".velite", "docs.json")
const docs: DocEntry[] = JSON.parse(fs.readFileSync(docsPath, "utf-8"))

const routes = docs.map((doc) => toRoutePath(doc.slugAsParams))
const uniqueRoutes = Array.from(new Set(["/", ...routes])).sort()

const outputFile = path.join("src", "velite-route.gen.ts")
const outputContent = `export const veliteRoutes = ${JSON.stringify(uniqueRoutes, null, 2)} as const

export type VeliteRoute = typeof veliteRoutes[number]
`

fs.writeFileSync(outputFile, outputContent, "utf-8")
console.log(`[ROUTES] Generated ${uniqueRoutes.length} static routes`)

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
