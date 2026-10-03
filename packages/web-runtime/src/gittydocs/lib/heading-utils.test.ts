import { describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fromMarkdown } from "mdast-util-from-markdown"
import { gfmFromMarkdown } from "mdast-util-gfm"
import { toHast } from "mdast-util-to-hast"
import { gfm } from "micromark-extension-gfm"
import rehypeSlug from "rehype-slug"
import { type Config, defineLoader, VeliteFile } from "velite"
import veliteConfig from "../../../velite.config"
import {
  extractHeadingsFromMarkdown,
  getDocHeadings,
  headingText,
  markdownToSearchText,
  parseHeadingInlineContent,
  slugifyHeadingText,
} from "./heading-utils"
import { createDocsSearch } from "./search-utils"
import { getCompiledHeadings } from "./velite/headings"

function compilerHeadingIds(markdown: string): string[] {
  const tree = toHast(
    fromMarkdown(markdown, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] })
  )
  if (tree.type !== "root") throw new Error("Expected a Markdown root")
  rehypeSlug()(tree)
  const ids: string[] = []
  const visit = (node: typeof tree | (typeof tree.children)[number]) => {
    if (node.type === "element" && /^h[1-6]$/.test(node.tagName))
      ids.push(String(node.properties.id))
    if ("children" in node) node.children.forEach(visit)
  }

  visit(tree)
  return ids
}

describe("heading extraction", () => {
  test("matches rehype-slug for Unicode, repeated headings, punctuation and inline Markdown", () => {
    const markdown = [
      "# Café déjà vu 中文 👋",
      "## *Hello* [world](https://example.com) &amp; `code`",
      "## Duplicate",
      "## Duplicate",
      "## Duplicate-1",
      "## Duplicate",
      "## C++ & API  -- setup",
      "## ![not part of the slug](image.png) Visible",
      "## Escaped \\*star\\* and ~~deleted~~",
      "## Title {#not-an-explicit-id}",
      "##",
    ].join("\n\n")
    expect(extractHeadingsFromMarkdown(markdown).map((heading) => heading.slug)).toEqual(
      compilerHeadingIds(markdown)
    )
    expect(
      extractHeadingsFromMarkdown(markdown)
        .slice(2, 6)
        .map((heading) => heading.slug)
    ).toEqual(["duplicate", "duplicate-1", "duplicate-1-1", "duplicate-2"])
    expect(extractHeadingsFromMarkdown(markdown)[0].slug).toBe("café-déjà-vu-中文-")
  })

  test("assigns slugs to referenced footnote headings in compiler output order", () => {
    const markdown = "## Note\n\n[^ref]:\n    ## Note\n\nSee[^ref]"
    expect(extractHeadingsFromMarkdown(markdown).map((heading) => heading.slug)).toEqual([
      "note",
      "note-1",
    ])
  })

  test("does not include MDX expression source in heading anchors or execute it", () => {
    const headings = extractHeadingsFromMarkdown(
      "## Hello {name}\n## Hello {name}\n## Literal `{name}`"
    )
    expect(headings.map((heading) => heading.slug)).toEqual(["hello-", "hello--1", "literal-name"])
    expect(headings[0].plainText).toBe("Hello ")
  })

  test("handles ATX, closing hashes, setext and nested block headings", () => {
    const markdown =
      "  ## Indented `code` ##\n\nSetext *title*\n===\n\n> ### Quoted\n\n- #### Listed"
    const headings = extractHeadingsFromMarkdown(markdown)
    expect(headings.map((heading) => heading.level)).toEqual([2, 1, 3, 4])
    expect(headings[0].text).toBe("Indented `code`")
    expect(headings.map((heading) => heading.slug)).toEqual(compilerHeadingIds(markdown))
  })

  test("ignores YAML, fenced/indented code and raw HTML blocks", () => {
    const markdown = [
      "---",
      "title: |",
      "  # Not a heading",
      "---",
      "",
      "```md",
      "# Not a heading",
      "~~~~",
      "```",
      "",
      "~~~md",
      "## Not a heading",
      "~~~~",
      "",
      "    # Indented code",
      "",
      "<div>",
      "# HTML block",
      "</div>",
      "",
      "## Real",
      "## Real",
    ].join("\n")
    expect(extractHeadingsFromMarkdown(markdown).map((heading) => heading.slug)).toEqual([
      "real",
      "real-1",
    ])
  })

  test("does not invent unsupported explicit-ID syntax", () => {
    expect(extractHeadingsFromMarkdown("## Hello {#custom}")[0].slug).toBe("hello-custom")
  })

  test("retains inline code segments, including multi-backtick delimiters", () => {
    expect(parseHeadingInlineContent("Use **bold** and ``a`b`` [link](url)")).toEqual([
      { type: "text", value: "Use bold and " },
      { type: "code", value: "a`b" },
      { type: "text", value: " link" },
    ])
    expect(headingText("[Héllo](url) `world`")).toBe("Héllo world")
    expect(slugifyHeadingText("[Héllo](url) `world`")).toBe("héllo-world")
  })

  test("search text is inert and excludes frontmatter without discarding inline code", () => {
    const text = markdownToSearchText(
      "---\ntitle: private\n---\n# **Hello**\n\nUse `C++` &amp; &lt;img onerror=alert(1)&gt;."
    )
    expect(text).toBe("Hello Use C++ & <img onerror=alert(1)>.")
  })
})

// Exercise the real s.mdx() schema and configured plugin order without running
// a Velite build, touching generated content, or evaluating any user code.
async function compileDoc(markdown: string) {
  const directory = await mkdtemp(path.join(tmpdir(), "gittydocs-heading-"))
  const filename = path.join(directory, "docs", "fixture.mdx")
  const ids: string[] = []
  const captureIds = () => (tree: Parameters<ReturnType<typeof rehypeSlug>>[0]) => {
    const visit = (node: typeof tree | (typeof tree.children)[number]) => {
      if (node.type === "element" && /^h[1-6]$/.test(node.tagName)) {
        ids.push(String(node.properties.id))
      }
      if ("children" in node) node.children.forEach(visit)
    }
    visit(tree)
  }
  const config: Config = {
    ...veliteConfig,
    prepare: undefined,
    complete: undefined,
    configPath: path.join(directory, "velite.config.ts"),
    configImports: [],
    cache: new Map(),
    root: directory,
    output: {
      data: path.join(directory, ".velite"),
      assets: path.join(directory, "static"),
      base: "/static/",
      name: "[name]-[hash:6].[ext]",
      clean: true,
      format: "esm",
    },
    mdx: {
      ...veliteConfig.mdx,
      copyLinkedFiles: false,
      rehypePlugins: [...(veliteConfig.mdx?.rehypePlugins ?? []), captureIds],
    },
    loaders: [
      defineLoader({
        test: /\.mdx$/,
        load: (file) => ({
          // Heading metadata is derived, never trusted from frontmatter.
          data: { headings: [{ slug: "forged" }] },
          content: file.toString(),
        }),
      }),
    ],
  }
  try {
    await mkdir(path.dirname(filename), { recursive: true })
    await writeFile(filename, markdown)
    const meta = await VeliteFile.create({ path: filename, config })
    const doc = await veliteConfig.collections.docs.schema.parseAsync(meta.records, { meta })
    return { doc, ids, meta }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

describe("compiler heading metadata", () => {
  test("uses exact post-KaTeX IDs but readable labels with inline code", async () => {
    const { doc, ids, meta } = await compileDoc(
      [
        "## Use `C++` $x^2$",
        "## Use `C++` $x^2$",
        "## **Bold** [linked](https://example.com) &amp; ``a`b``",
        "## Literal \\{braces\\} \\*stars\\* &lt;tag&gt; \\`tick\\`",
        "## Fraction $\\frac{x}{y}$",
      ].join("\n\n")
    )
    expect(doc.headings.map((heading) => heading.slug)).toEqual(ids)
    expect(doc.headings[0].slug).toBe("use-c-x2x2x2")
    expect(doc.headings[1].slug).toBe("use-c-x2x2x2-1")
    expect(doc.headings[0].plainText).toBe("Use C++ x^2")
    expect(parseHeadingInlineContent(doc.headings[0].text)).toEqual([
      { type: "text", value: "Use " },
      { type: "code", value: "C++" },
      { type: "text", value: " x^2" },
    ])
    expect(parseHeadingInlineContent(doc.headings[2].text)).toEqual([
      { type: "text", value: "Bold linked & " },
      { type: "code", value: "a`b" },
    ])
    expect(headingText(doc.headings[3].text)).toBe("Literal {braces} *stars* <tag> `tick`")
    expect(headingText(doc.headings[4].text)).toBe("Fraction \\frac{x}{y}")
    expect(doc.headings[4].plainText).toBe("Fraction \\frac{x}{y}")
    expect(getCompiledHeadings(meta)).toBe(doc.headings)
    expect(getDocHeadings(doc)).toBe(doc.headings)
  })

  test("never executes or parses arbitrary MDX expression/ESM source as headings", async () => {
    const { doc, ids } = await compileDoc(
      [
        "export const fake = `\n## Not a heading\n`",
        "{`\n## Not a heading\n`}",
        "{/*\n## Not a heading\n*/}",
        "<Component sample={`\n## Not a heading\n`}>\n\n## Inside component\n\n</Component>",
        '## Hello {(() => { throw new Error("must not execute") })()} world',
        '## Hello {({nested: {value: "}"}}).nested.value} world',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: MDX fixture, not evaluated here.
        '## Hello {`# fake ${"value"}`} world',
        '## Hello {/\\{.*\\}/.test("{value}")} world',
        "## Inline <span>**visible** `code`</span>",
      ].join("\n\n")
    )
    expect(doc.headings.map((heading) => heading.slug)).toEqual(ids)
    expect(doc.headings.map((heading) => heading.slug)).toEqual([
      "inside-component",
      "hello--world",
      "hello--world-1",
      "hello--world-2",
      "hello--world-3",
      "inline-visible-code",
    ])
    expect(headingText(doc.headings[1].text)).toBe("Hello  world")
    expect(parseHeadingInlineContent(doc.headings[doc.headings.length - 1].text)).toEqual([
      { type: "text", value: "Inline visible " },
      { type: "code", value: "code" },
    ])
  })

  test("round-trips literal block syntax and tricky code spans in ToC labels", async () => {
    const { doc } = await compileDoc(
      [
        "## 1. Ordered-looking",
        "## - List-looking",
        "## Use `` `edge` `` and `a`<span />`b`",
        "## Use `   ` and ` leading` and `trailing `",
      ].join("\n\n")
    )
    for (const heading of doc.headings) {
      expect(headingText(heading.text)).toBe(heading.plainText!)
    }
    expect(parseHeadingInlineContent(doc.headings[2].text)).toEqual([
      { type: "text", value: "Use " },
      { type: "code", value: "`edge`" },
      { type: "text", value: " and " },
      { type: "code", value: "ab" },
    ])
  })

  test("retains compiler ordering for nested/setext/empty and footnote headings", async () => {
    const { doc, ids } = await compileDoc(
      [
        "Setext `code`\n===",
        "> ### Quoted",
        "- #### Listed",
        "##",
        "## Note[^ref]",
        "[^ref]:\n    ## Note\n\n    Footnote body",
      ].join("\n\n")
    )
    expect(doc.headings.map((heading) => heading.slug)).toEqual(
      ids.filter((id) => id !== "footnote-label")
    )
    expect(doc.headings.map((heading) => heading.level)).toEqual([1, 3, 4, 2, 2, 2])
    expect(doc.headings[4].plainText).toBe("Note1")
    expect(headingText(doc.headings[4].text)).toBe("Note1")
  })

  test("prefers compiler metadata even when empty and falls back for older data", async () => {
    const { doc } = await compileDoc("{`\n## False heading\n`}")
    expect(doc.headings).toEqual([])
    expect(getDocHeadings(doc)).toEqual([])
    expect(getDocHeadings({ headings: [], rawMarkdown: "## False heading" })).toEqual([])
    expect(getDocHeadings({ rawMarkdown: "## Legacy" })[0].slug).toBe("legacy")
    expect(getDocHeadings({})).toEqual([])
  })

  test("keeps metadata isolated across documents and uses exact search anchor URLs", async () => {
    const [{ doc: first }, { doc: second }] = await Promise.all([
      compileDoc("## 中文 $x^2$\n\n## 中文 $x^2$"),
      compileDoc("## Other `code`"),
    ])
    expect(first.headings).toHaveLength(2)
    expect(second.headings.map((heading) => heading.slug)).toEqual(["other-code"])
    const search = createDocsSearch([
      {
        routePath: "/math",
        sourcePath: "math.mdx",
        title: "Math",
        content: first.content,
        rawContent: first.rawMarkdown,
        headings: getDocHeadings(first),
      },
    ])
    const results = search("x^2").flatMap((group) => group.results)
    expect(results[0].title).toBe("中文 x^2")
    expect(results[0].href).toBe(`/math#${encodeURIComponent(first.headings[0].slug)}`)
    expect(results[0].kind).toBe("heading")
  })

  test("recompiling a path cannot reuse the prior file's heading metadata", async () => {
    const { doc, meta } = await compileDoc("## Before")
    const filename = meta.path
    try {
      await mkdir(path.dirname(filename), { recursive: true })
      await writeFile(filename, "{`\n## False heading\n`}")
      const updated = await VeliteFile.create({ path: filename, config: meta.config })
      const next = await veliteConfig.collections.docs.schema.parseAsync(updated.records, {
        meta: updated,
      })
      expect(next.headings).toEqual([])
      expect(getCompiledHeadings(meta)).toBe(doc.headings)
      expect(getCompiledHeadings(updated)).toBe(next.headings)
    } finally {
      await rm(meta.config.root, { recursive: true, force: true })
    }
  })
})
