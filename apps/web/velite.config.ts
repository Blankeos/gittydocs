import rehypeShiki from "@shikijs/rehype"
import rehypeAutolinkHeadings from "rehype-autolink-headings"
import rehypeKatex from "rehype-katex"
import rehypeSlug from "rehype-slug"
import remarkGfm from "remark-gfm"
import remarkGithubBlockquoteAlert from "remark-github-blockquote-alert"
import remarkMath from "remark-math"
import { defineConfig, s } from "velite"

export default defineConfig({
  root: "content",
  output: {
    data: ".velite",
    assets: "public/static",
    base: "/static/",
    name: "[name]-[hash:6].[ext]",
    clean: true,
  },
  collections: {
    docs: {
      name: "Docs",
      pattern: "**/docs/**/*.{md,mdx}",
      schema: s
        .object({
          slug: s.path(),
          title: s.string().optional(),
          description: s.string().optional(),
          date: s.string().optional(),
          categories: s.string().array().optional(),
          tags: s.string().array().optional(),
          metadata: s.metadata(),
          content: s.mdx(),
          excerpt: s.excerpt({ length: Infinity }),
          rawMarkdown: s.raw(),
          rawText: s.custom().transform((data, { meta }) => meta.plain as string),
        })
        .transform(async (data) => {
          return {
            ...data,
            title: data.title ?? deriveTitle(data.rawMarkdown, data.slug),
            slugAsParams: data.slug.split("/").slice(1).join("/"),
          }
        }),
    },
  },
  mdx: {
    remarkPlugins: [remarkGfm, remarkMath, remarkGithubBlockquoteAlert],
    rehypePlugins: [
      [rehypeShiki, { theme: "one-dark-pro" }],
      rehypeKatex,
      rehypeSlug,
      [
        rehypeAutolinkHeadings,
        {
          properties: {
            className: ["subheading-anchor"],
            ariaLabel: "Link to section",
          },
        },
      ],
    ],
  },
})

function deriveTitle(content: string, slug: string) {
  const lines = content.split("\n")
  const firstHeading = lines.find((line) => line.startsWith("# "))
  if (firstHeading) {
    return firstHeading.replace(/^#\s+/, "").trim()
  }
  const slugParts = slug.split("/")
  const fallback = slugParts[slugParts.length - 1] || "Untitled"
  return fallback
    .replace(/[-_]/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}
