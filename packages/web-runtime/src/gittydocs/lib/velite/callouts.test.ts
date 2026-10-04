import { describe, expect, test } from "bun:test"
import { createRequire } from "node:module"
import remarkGithubBlockquoteAlert from "remark-github-blockquote-alert"

// Reuse Velite's compiler without adding a direct dependency for these tests.
const require = createRequire(import.meta.url)
const veliteRequire = createRequire(require.resolve("velite"))
const { compile } = await import(veliteRequire.resolve("@mdx-js/mdx"))

type Node = {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: Node[]
}

async function compileTree(source: string, format: "md" | "mdx") {
  let tree!: Node
  await compile(source, {
    format,
    remarkPlugins: [remarkGithubBlockquoteAlert],
    rehypePlugins: [
      () => (result: Node) => {
        tree = result
      },
    ],
  })
  return tree
}

function descendants(node: Node): Node[] {
  return [node, ...(node.children ?? []).flatMap(descendants)]
}

function text(node: Node): string {
  return node.value ?? (node.children ?? []).map(text).join("")
}

function classes(node: Node): string[] {
  const value = node.properties?.className
  return Array.isArray(value) ? value : typeof value === "string" ? value.split(" ") : []
}

const variants = ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"] as const

for (const format of ["md", "mdx"] as const) {
  describe(`GitHub callouts in ${format}`, () => {
    test.each([...variants])("compiles %s with its title, icon, and body", async (variant) => {
      const tree = await compileTree(
        `> [!${variant}]\n> Read **this** first.\n>\n> A second paragraph.`,
        format
      )
      const nodes = descendants(tree)
      const alerts = nodes.filter((node) => classes(node).includes("markdown-alert"))
      expect(alerts).toHaveLength(1)
      const alert = alerts[0]!
      expect(alert.tagName).toBe("div")
      expect(classes(alert)).toEqual(["markdown-alert", `markdown-alert-${variant.toLowerCase()}`])
      expect(alert.properties?.dir).toBe("auto")

      const titles = descendants(alert).filter((node) =>
        classes(node).includes("markdown-alert-title")
      )
      expect(titles).toHaveLength(1)
      const title = titles[0]!
      expect(title.tagName).toBe("p")
      expect(text(title)).toBe(variant)
      const icons = descendants(title).filter((node) => node.tagName === "svg")
      expect(icons).toHaveLength(1)
      const icon = icons[0]!
      expect(classes(icon)).toContain("octicon")
      expect(icon.properties).toMatchObject({
        viewBox: "0 0 16 16",
        width: "16",
        height: "16",
        ariaHidden: "true",
      })
      const paths = descendants(icon).filter((node) => node.tagName === "path")
      expect(paths).toHaveLength(1)
      expect(paths[0]?.properties?.d).toBeTruthy()

      expect(text(alert)).toContain("Read this first.")
      expect(text(alert)).toContain("A second paragraph.")
      expect(text(alert)).not.toContain(`[!${variant}]`)
      expect(
        descendants(alert).some((node) => node.tagName === "strong" && text(node) === "this")
      ).toBe(true)
      expect(nodes.some((node) => node.tagName === "blockquote")).toBe(false)
    })

    test("keeps ordinary blockquotes unchanged", async () => {
      const tree = await compileTree("> An ordinary **quote**.\n>\n> Another paragraph.", format)
      const nodes = descendants(tree)
      const quotes = nodes.filter((node) => node.tagName === "blockquote")
      expect(quotes).toHaveLength(1)
      expect(classes(quotes[0]!)).toEqual([])
      expect(text(quotes[0]!)).toContain("An ordinary quote.")
      expect(text(quotes[0]!)).toContain("Another paragraph.")
      expect(nodes.some((node) => classes(node).includes("markdown-alert"))).toBe(false)
      expect(nodes.some((node) => node.tagName === "svg")).toBe(false)
    })

    test.each(["```", "~~~~"])("keeps all markers literal in %s fences", async (fence) => {
      const source = variants.map((variant) => `> [!${variant}]\n> Example only.`).join("\n\n")
      const tree = await compileTree(`${fence}md\n${source}\n${fence}`, format)
      const nodes = descendants(tree)
      const code = nodes.filter((node) => node.tagName === "code")
      expect(code).toHaveLength(1)
      expect(text(code[0]!)).toBe(`${source}\n`)
      expect(classes(code[0]!)).toEqual(["language-md"])
      expect(nodes.some((node) => classes(node).includes("markdown-alert"))).toBe(false)
      expect(nodes.some((node) => node.tagName === "blockquote" || node.tagName === "svg")).toBe(
        false
      )
    })
  })
}
