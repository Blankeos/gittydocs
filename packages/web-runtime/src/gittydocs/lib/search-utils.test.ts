import { describe, expect, test } from "bun:test"
import type { DocsPage } from "../contexts/docs.context"
import type { NavItem } from "./config-schema"
import { extractHeadingsFromMarkdown } from "./heading-utils"
import { createDocsSearch, createSearchEntries, groupSearchResults } from "./search-utils"

function page(routePath: string, title: string, rawContent = "", description?: string): DocsPage {
  return {
    routePath,
    title,
    rawContent,
    description,
    headings: extractHeadingsFromMarkdown(rawContent),
    content: "",
    sourcePath: `${routePath.slice(1)}.mdx`,
  }
}

const nav: NavItem[] = [
  {
    label: "Docs",
    items: [
      { label: "Introduction", path: "/intro" },
      {
        label: "Components",
        items: [{ label: "Button", path: "/components/button", icon: "code" } as NavItem],
      },
    ],
  },
]

describe("search metadata and grouping", () => {
  test("uses nav sections/subsections, page icons and distinct page/heading identities", () => {
    const entries = createSearchEntries(
      [page("/components/button", "Button", "## Usage\n## Usage")],
      nav
    )
    expect(entries[0].context).toBe("Docs › Components")
    expect(entries[0].groupLabel).toBe("Docs › Components")
    expect(entries[0].icon).toBe("code")
    expect(entries[1].context).toBe("Docs › Components › Button")
    expect(entries.map((entry) => entry.id)).toEqual([
      "page:/components/button",
      "heading:/components/button#usage",
      "heading:/components/button#usage-1",
    ])
    expect(entries[2].href).toBe("/components/button#usage-1")
  })

  test("keeps custom pages and docs omitted from nav (including sidebar:false) searchable", () => {
    const entries = createSearchEntries(
      [
        page("/custom", "Custom landing", "", "A custom TSX page"),
        page("/guides/hidden", "Hidden guide", "Preserved searchable content"),
      ],
      nav
    )
    const search = createDocsSearch(entries)
    expect(search("custom")[0].title).toBe("Custom landing")
    expect(search("preserved")[0].title).toBe("Hidden guide")
    expect(entries[1].groupLabel).toBe("Guides")
  })

  test("infers groups from route directories without a nav trail", () => {
    const entries = createSearchEntries([page("/api-reference/client/setup", "Setup")], [])
    expect(entries[0].context).toBe("Api Reference › Client")
  })

  test("encodes Unicode heading anchors without changing the actual slug", () => {
    const entry = createSearchEntries([page("/intro", "Intro", "## 中文")], nav)[1]
    expect(entry.href).toBe("/intro#%E4%B8%AD%E6%96%87")
    expect(entry.heading?.slug).toBe("中文")
  })

  test("keeps same-labelled nav branches distinct", () => {
    const groupsNav: NavItem[] = [
      { label: "Guides", items: [{ label: "A", path: "/a" }] },
      { label: "Guides", items: [{ label: "B", path: "/b" }] },
    ]
    const groups = groupSearchResults(
      createDocsSearch(createSearchEntries([page("/a", "A"), page("/b", "B")], groupsNav))("")
    )
    expect(groups).toHaveLength(2)
    expect(groups[0].id).not.toBe(groups[1].id)
  })

  test("groups a clickable landing with its children without repeating heading context", () => {
    const componentsNav: NavItem[] = [
      {
        label: "Components",
        path: "/components",
        items: [{ label: "Code blocks", path: "/components/code-blocks" }],
      },
    ]
    const entries = createSearchEntries(
      [
        page("/components/code-blocks", "Code blocks", "## Usage"),
        page("/components", "Components", "## Overview"),
      ],
      componentsNav
    )
    expect(entries.map((entry) => entry.groupLabel)).toEqual(Array(4).fill("Components"))
    expect(entries.map((entry) => entry.context)).toEqual([
      "Components",
      "Components",
      "Components",
      "Components › Code blocks",
    ])
    expect(new Set(entries.map((entry) => entry.groupId)).size).toBe(1)
    expect(entries[0].navItem).toBe(componentsNav[0])
    const groups = groupSearchResults(createDocsSearch(entries)(""))
    expect(groups).toHaveLength(1)
    expect(groups[0].results.map((entry) => entry.title)).toEqual(["Components", "Code blocks"])
  })

  test("keeps nested, same-labelled landing groups distinct by nav identity", () => {
    const groupsNav: NavItem[] = [
      {
        label: "Docs",
        items: [
          {
            label: "Components",
            path: "/components",
            items: [{ label: "Code blocks", path: "/components/code" }],
          },
          {
            label: "Components",
            path: "/other",
            items: [{ label: "Code blocks", path: "/other/code" }],
          },
        ],
      },
    ]
    const entries = createSearchEntries(
      [
        page("/components", "Components", "## Overview"),
        page("/components/code", "Code blocks"),
        page("/other", "Component overview", "## Details"),
        page("/other/code", "Code blocks"),
      ],
      groupsNav
    )
    expect(entries.every((entry) => entry.groupLabel === "Docs › Components")).toBe(true)
    expect(entries[1].context).toBe("Docs › Components")
    expect(entries[4].context).toBe("Docs › Components › Component overview")
    expect(entries[0].groupId).toBe(entries[2].groupId)
    expect(entries[3].groupId).toBe(entries[5].groupId)
    expect(entries[0].groupId).not.toBe(entries[3].groupId)
    const groups = groupSearchResults(createDocsSearch(entries)(""))
    expect(groups).toHaveLength(2)
    expect(groups.map((group) => group.results.map((result) => result.routePath))).toEqual([
      ["/components", "/components/code"],
      ["/other", "/other/code"],
    ])
  })

  test("empty child arrays remain leaves, not landing groups", () => {
    const entries = createSearchEntries(
      [page("/components", "Components", "## Overview")],
      [{ label: "Docs", items: [{ label: "Components", path: "/components", items: [] }] }]
    )
    expect(entries[0].groupLabel).toBe("Docs")
    expect(entries[1].context).toBe("Docs › Components")
  })

  test("ignores non-route and unsafe nav hrefs for ordering and metadata", () => {
    const invalidNav: NavItem[] = [
      { label: "Fragment", path: "#intro" },
      { label: "Query", path: "?q=intro" },
      { label: "Email", path: "mailto:intro" },
      { label: "Encoded script", path: "javascript%3Aalert(1)" },
      { label: "Unsafe route", path: "/unsafe\n" },
      { label: "External", path: "https://example.com/intro" },
      { label: "Valid", path: "/intro" },
    ]
    const entries = createSearchEntries(
      [page("/unsafe\n", "Unsafe"), page("/intro", "Intro")],
      invalidNav
    )
    expect(entries[0].title).toBe("Intro")
    expect(entries[0].navItem).toBe(invalidNav[6])
    expect(entries[1].navItem).toBeUndefined()
  })

  test("navigation order wins and browse contains useful grouped pages only", () => {
    const search = createDocsSearch(
      createSearchEntries(
        [page("/components/button", "Button", "## Usage"), page("/intro", "Introduction")],
        nav
      )
    )
    expect(search(" ").map((entry) => entry.title)).toEqual(["Introduction", "Button"])
    expect(search("").every((entry) => entry.kind === "page")).toBe(true)
    expect(groupSearchResults(search("")).map((group) => group.label)).toEqual([
      "Docs",
      "Docs › Components",
    ])
  })
})

describe("FlexSearch partial matches and ranking", () => {
  test("ranks page titles and heading titles above incidental body matches", () => {
    const search = createDocsSearch(
      createSearchEntries(
        [
          page("/body", "General", "A button is mentioned."),
          page("/components/button", "Button", "## Button\n## Setup"),
          page("/setup", "Setup"),
        ],
        nav
      )
    )
    expect(
      search("button")
        .slice(0, 2)
        .map((entry) => entry.kind)
    ).toEqual(["page", "heading"])
    expect(search("setup")[0].kind).toBe("page")
    expect(
      search("setup").some((entry) => entry.kind === "heading" && entry.href.endsWith("#setup"))
    ).toBe(true)
    expect(search("setup").some((entry) => entry.kind === "page" && entry.title === "Button")).toBe(
      false
    )
  })

  test("preserves partial word and punctuation title searches", () => {
    const search = createDocsSearch(
      createSearchEntries(
        [page("/intro", "Introduction", "## Configuration"), page("/cpp", "C++ API")],
        nav
      )
    )
    expect(search("duct")[0].title).toBe("Introduction")
    expect(search("figur")[0].title).toBe("Configuration")
    expect(search("C++")[0].title).toBe("C++ API")
    expect(() => search("[")).not.toThrow()
    expect(search("totally-absent")).toEqual([])
  })

  test("body highlights survive a description that does not contain the query", () => {
    const search = createDocsSearch(
      createSearchEntries(
        [page("/intro", "Intro", 'Literal &lt;img onerror="alert(1)"&gt; needle.', "An overview")],
        nav
      )
    )
    const result = search("needle")[0]
    expect(result.snippet).toContain('<img onerror="alert(1)">')
    expect(result.highlights.some((segment) => segment.matched && segment.text === "needle")).toBe(
      true
    )
    expect(result.highlights.map((segment) => segment.text).join("")).toBe(result.snippet)
  })

  test("bounds result counts and prevents one page's headings from flooding search", () => {
    const pages = Array.from({ length: 40 }, (_, index) =>
      page(
        `/page-${index}`,
        `Page ${index}`,
        Array.from({ length: 8 }, (_, heading) => `## Shared heading ${heading}`).join("\n")
      )
    )
    const search = createDocsSearch(createSearchEntries(pages, []))
    expect(search("")).toHaveLength(24)
    const results = search("shared")
    expect(results).toHaveLength(24)
    expect(
      results.filter((entry) => entry.routePath === "/page-0" && entry.kind === "heading").length
    ).toBeLessThanOrEqual(5)
  })
})
