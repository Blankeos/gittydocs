import { docs } from "@velite"
import { gittydocsConfig } from "@/lib/docs/config.gen"
import { sourcePathByRoute } from "@/lib/docs/source-map.gen"
import type { DocsConfig, DocsPage, Heading } from "@/lib/gittydocs/types"

export const docsConfig: DocsConfig | null = gittydocsConfig

console.log(
  "[DEBUG] docs from velite:",
  docs.map((d) => ({ slug: d.slug, slugAsParams: d.slugAsParams, title: d.title }))
)

export const docsPages = docs.map((doc) => {
  const routePath = toRoutePath(doc.slugAsParams)
  const sourcePath = sourcePathByRoute[routePath] || `${doc.slugAsParams}.mdx`
  const headings = extractHeadings(doc.rawMarkdown || "")

  return {
    routePath,
    sourcePath,
    title: doc.title || "Untitled",
    description: doc.description,
    date: doc.date,
    categories: doc.categories,
    headings,
    content: doc.content,
    rawContent: doc.rawMarkdown || "",
  } satisfies DocsPage
})

export function toRoutePath(slug: string) {
  let route = slug.replace(/^\/?/, "")
  if (route.endsWith("/index") || route === "index") {
    route = route.replace(/\/?index$/, "") || "/"
  }
  if (route.endsWith("/readme") || route.toLowerCase() === "readme") {
    route = route.replace(/\/?readme$/, "") || "/"
  }
  return route.startsWith("/") ? route : `/${route}`
}

function extractHeadings(content: string): Heading[] {
  const headings: Heading[] = []
  const lines = content.split("\n")

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/)
    if (!match) continue
    const level = match[1].length
    const text = match[2].trim()
    const slug = slugify(text)
    headings.push({ level, text, slug })
  }

  return headings
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
}
