import { describe, expect, test } from "bun:test"
import type { DocsPage } from "../contexts/docs.context"
import type { NavItem } from "./config-schema"
import { extractHeadingsFromMarkdown } from "./heading-utils"
import { createDocsNavigation } from "./nav-utils"
import { createDocsSearch } from "./search-utils"

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

function results(groups: ReturnType<ReturnType<typeof createDocsSearch>>) {
  return groups.flatMap((group) => group.results)
}

describe("search metadata and grouping", () => {
  test("returns public page/heading metadata, icons and distinct heading identities", () => {
    const pages = [page("/components/button", "Button", "## Usage\n## Usage")]
    const search = createDocsSearch(pages, createDocsNavigation(pages, nav))
    const browse = search("")
    expect(browse[0].label).toBe("Docs › Components")
    const entry = browse[0].results[0]
    expect(entry.context).toBe("Docs › Components")
    expect(entry.icon).toBe("code")
    expect(entry.navItem).toBe(nav[0].items![1].items![0])
    expect(entry.id).toBe("page:/components/button")
    const headings = results(search("Usage"))
    expect(headings.map((result) => result.id)).toEqual([
      "heading:/components/button#usage",
      "heading:/components/button#usage-1",
    ])
    expect(headings[0].context).toBe("Docs › Components › Button")
    expect(headings[1].href).toBe("/components/button#usage-1")
    expect(headings[1].pageTitle).toBe("Button")
    for (const result of [entry, ...headings]) {
      for (const field of ["indexText", "body", "description", "order", "groupId", "groupLabel"]) {
        expect(result).not.toHaveProperty(field)
      }
    }
  })

  test("same-labelled groups stay distinct even when their explicit landings are external or missing", () => {
    const pages = [page("/a", "A"), page("/b", "B")]
    const nav = [
      { label: "Guides", path: "https://example.com", items: [{ label: "A", path: "/a" }] },
      { label: "Guides", path: "/missing", items: [{ label: "B", path: "/b" }] },
    ]
    const search = createDocsSearch(pages, createDocsNavigation(pages, nav))
    const groups = search("")
    expect(groups).toHaveLength(2)
    expect(groups[0].id).not.toBe(groups[1].id)
    expect(groups.map((group) => group.results.map((result) => result.routePath))).toEqual([
      ["/a"],
      ["/b"],
    ])
    const unrelated = { label: "Unrelated", path: "/other" }
    const nextSearch = createDocsSearch(pages, createDocsNavigation(pages, [unrelated, ...nav]))
    expect(nextSearch("").map((group) => group.id)).toEqual(groups.map((group) => group.id))
  })

  test("custom and omitted pages remain searchable by title, description and body", () => {
    const pages = [
      page("/custom", "Custom landing", "", "A custom TSX page"),
      page("/guides/hidden", "Hidden guide", "Preserved searchable content"),
    ]
    const search = createDocsSearch(pages, createDocsNavigation(pages, nav))
    expect(results(search("custom"))[0].title).toBe("Custom landing")
    expect(results(search("TSX"))[0].title).toBe("Custom landing")
    expect(results(search("preserved"))[0].title).toBe("Hidden guide")
    expect(search("preserved")[0].label).toBe("Guides")
    expect(results(search("preserved"))[0].navItem).toBeUndefined()
  })

  test("default navigation infers context from directories", () => {
    const search = createDocsSearch([page("/api-reference/client/setup", "Setup")])
    expect(results(search("Setup"))[0].context).toBe("Api Reference › Client")
  })

  test("encodes Unicode heading anchors without changing their slug", () => {
    const pages = [page("/intro", "Intro", "## 中文")]
    const heading = results(createDocsSearch(pages, createDocsNavigation(pages, nav))("中文")).find(
      (result) => result.kind === "heading"
    )
    expect(heading?.href).toBe("/intro#%E4%B8%AD%E6%96%87")
    expect(heading?.heading?.slug).toBe("中文")
  })

  test("keeps same-labelled pathless branches distinct", () => {
    const groupsNav = [
      { label: "Guides", items: [{ label: "A", path: "/a" }] },
      { label: "Guides", items: [{ label: "B", path: "/b" }] },
    ]
    const pages = [page("/a", "A"), page("/b", "B")]
    const groups = createDocsSearch(pages, createDocsNavigation(pages, groupsNav))("")
    expect(groups.map((group) => group.label)).toEqual(["Guides", "Guides"])
    expect(groups[0].id).not.toBe(groups[1].id)
    expect(groups.map((group) => group.results.map((result) => result.routePath))).toEqual([
      ["/a"],
      ["/b"],
    ])
  })

  test("groups a clickable landing with children without repeating heading context", () => {
    const componentsNav = [
      {
        label: "Components",
        path: "/components",
        items: [{ label: "Code blocks", path: "/components/code-blocks" }],
      },
    ]
    const pages = [
      page("/components/code-blocks", "Code blocks", "## Usage"),
      page("/components", "Components", "## Overview"),
    ]
    const search = createDocsSearch(pages, createDocsNavigation(pages, componentsNav))
    const groups = search("")
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe("Components")
    expect(groups[0].results.map((result) => result.title)).toEqual(["Components", "Code blocks"])
    expect(groups[0].results[0].navItem).toBe(componentsNav[0])
    expect(results(search("Overview"))[0].context).toBe("Components")
    expect(results(search("Usage"))[0].context).toBe("Components › Code blocks")
  })

  test("keeps nested same-labelled landing groups distinct", () => {
    const groupsNav = [
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
    const pages = [
      page("/components", "Components", "## Overview"),
      page("/components/code", "Code blocks"),
      page("/other", "Component overview", "## Details"),
      page("/other/code", "Code blocks"),
    ]
    const search = createDocsSearch(pages, createDocsNavigation(pages, groupsNav))
    const groups = search("")
    expect(groups.map((group) => group.label)).toEqual(["Docs › Components", "Docs › Components"])
    expect(groups[0].id).not.toBe(groups[1].id)
    expect(groups.map((group) => group.results.map((result) => result.routePath))).toEqual([
      ["/components", "/components/code"],
      ["/other", "/other/code"],
    ])
    expect(results(search("Overview")).find((result) => result.kind === "heading")?.context).toBe(
      "Docs › Components"
    )
    expect(results(search("Details"))[0].context).toBe("Docs › Components › Component overview")
  })

  test("empty child arrays are leaves, not landing groups", () => {
    const pages = [page("/components", "Components", "## Overview")]
    const navigation = createDocsNavigation(pages, [
      { label: "Docs", items: [{ label: "Components", path: "/components", items: [] }] },
    ])
    const search = createDocsSearch(pages, navigation)
    expect(search("")[0].label).toBe("Docs")
    expect(results(search("Overview"))[0].context).toBe("Docs › Components")
  })

  test("excludes unsafe/non-route page identities and missing nav destinations", () => {
    const invalidPaths = [
      "#intro",
      "?q=intro",
      "mailto:intro",
      "javascript%3Aalert(1)",
      "/unsafe\n",
      "/unsafe%250a",
      "https://example.com/intro",
    ]
    const valid = { label: "Valid", path: "/intro" }
    const invalidNav = [
      ...invalidPaths.map((path) => ({ label: "Invalid", path })),
      { label: "Missing", path: "/missing" },
      { label: "LLMs", path: "/llms.txt" },
      valid,
    ]
    const pages = [
      ...invalidPaths.map((path) => page(path, "Unsafe")),
      page("/intro", "Intro"),
      page("/hidden", "Hidden"),
    ]
    const search = createDocsSearch(pages, createDocsNavigation(pages, invalidNav))
    expect(results(search("")).map((result) => result.title)).toEqual(["Intro", "Hidden"])
    expect(results(search("Intro"))[0].navItem).toBe(valid)
    expect(results(search("Hidden"))[0].navItem).toBeUndefined()
    expect(search("Unsafe")).toEqual([])
    expect(search("Missing")).toEqual([])
    expect(search("LLMs")).toEqual([])
  })

  test("normalizes whitespace and BASE_URL routes and deduplicates pages and nav", () => {
    const pages = [
      page(" /docs/intro/ ", "Introduction", "## Usage"),
      page("/intro", "Duplicate"),
      page("/docs/next", "Next"),
    ]
    const first = { label: "First", path: " /docs/intro/?q=1#start " }
    const navigation = createDocsNavigation(
      pages,
      [
        {
          label: "Docs",
          items: [first, { label: "Duplicate", path: "/intro/" }, { label: "Next", path: "/next" }],
        },
      ],
      "/docs/"
    )
    const search = createDocsSearch(pages, navigation)
    const browse = results(search("   "))
    expect(browse.map((result) => result.routePath)).toEqual(["/intro", "/next"])
    expect(browse[0]).toMatchObject({
      id: "page:/intro",
      title: "Introduction",
      href: "/intro",
      context: "Docs",
    })
    expect(browse[0].navItem).toBe(first)
    expect(results(search(" Usage "))[0]).toMatchObject({
      id: "heading:/intro#usage",
      href: "/intro#usage",
      routePath: "/intro",
      context: "Docs › Introduction",
    })
    expect(search("Duplicate")).toEqual([])
  })

  test("browse follows navigation order and contains pages only", () => {
    const pages = [page("/components/button", "Button", "## Usage"), page("/intro", "Introduction")]
    const search = createDocsSearch(pages, createDocsNavigation(pages, nav))
    expect(results(search(" ")).map((result) => result.title)).toEqual(["Introduction", "Button"])
    expect(results(search("")).every((result) => result.kind === "page")).toBe(true)
    expect(search("").map((group) => group.label)).toEqual(["Docs", "Docs › Components"])
  })
})

describe("partial matches and ranking", () => {
  test("page and heading titles outrank incidental body matches", () => {
    const pages = [
      page("/body", "General", "A button is mentioned."),
      page("/components/button", "Button", "## Button\n## Setup"),
      page("/setup", "Setup"),
    ]
    const search = createDocsSearch(pages, createDocsNavigation(pages, nav))
    expect(
      results(search("button"))
        .slice(0, 2)
        .map((result) => result.kind)
    ).toEqual(["page", "heading"])
    expect(results(search("setup"))[0].kind).toBe("page")
    expect(
      results(search("setup")).some(
        (result) => result.kind === "heading" && result.href.endsWith("#setup")
      )
    ).toBe(true)
    expect(
      results(search("setup")).some((result) => result.kind === "page" && result.title === "Button")
    ).toBe(false)
  })

  test("preserves partial word and literal punctuation title searches", () => {
    const search = createDocsSearch([
      page("/intro", "Introduction", "## Configuration"),
      page("/cpp", "C++ API"),
      page("/brackets", "[Options]"),
    ])
    expect(results(search("duct"))[0].title).toBe("Introduction")
    expect(results(search("figur"))[0].title).toBe("Configuration")
    expect(results(search("C++"))[0].title).toBe("C++ API")
    expect(results(search("["))[0].title).toBe("[Options]")
    expect(search("totally-absent")).toEqual([])
  })

  test("body highlight text stays literal even when the description does not match", () => {
    const search = createDocsSearch([
      page("/intro", "Intro", 'Literal &lt;img onerror="alert(1)"&gt; needle.', "An overview"),
    ])
    const result = results(search("needle"))[0]
    expect(result.snippet).toContain('<img onerror="alert(1)">')
    expect(result.highlights.some((segment) => segment.matched && segment.text === "needle")).toBe(
      true
    )
    expect(result.highlights.map((segment) => segment.text).join("")).toBe(result.snippet)
    expect(result.highlights.every((segment) => typeof segment.text === "string")).toBe(true)
  })

  test("browse round-robins sections within the default limit of 24", () => {
    const pages = Array.from({ length: 30 }, (_, index) =>
      page(`/large/${index}`, `Large ${index}`)
    )
    pages.push(page("/small", "Small", "## Heading"), page("/deep/page", "Deep"))
    const navigation = createDocsNavigation(pages, [
      {
        label: "Large",
        items: pages.slice(0, 30).map((page) => ({ label: page.title, path: page.routePath })),
      },
      { label: "Small", items: [{ label: "Small", path: "/small" }] },
      {
        label: "Nested",
        items: [{ label: "Deep", items: [{ label: "Deep", path: "/deep/page" }] }],
      },
    ])
    const search = createDocsSearch(pages, navigation)
    const groups = search("")
    expect(results(groups)).toHaveLength(24)
    expect(groups.map((group) => group.results.length)).toEqual([22, 1, 1])
    expect(groups.map((group) => group.label)).toEqual(["Large", "Small", "Nested › Deep"])
    expect(results(groups).every((result) => result.kind === "page")).toBe(true)
    expect(
      results(createDocsSearch(pages, navigation, 2)("")).map((result) => result.title)
    ).toEqual(["Large 0", "Small"])
  })

  test("bounds search results and caps headings at five per page", () => {
    const pages = Array.from({ length: 40 }, (_, index) =>
      page(
        `/page-${index}`,
        `Page ${index}`,
        Array.from({ length: 8 }, (_, heading) => `## Shared heading ${heading}`).join("\n")
      )
    )
    const search = createDocsSearch(pages)
    expect(results(search(""))).toHaveLength(24)
    const matches = results(search("shared"))
    expect(matches).toHaveLength(24)
    for (const page of pages) {
      expect(
        matches.filter((result) => result.routePath === page.routePath && result.kind === "heading")
          .length
      ).toBeLessThanOrEqual(5)
    }
    expect(results(createDocsSearch([pages[0]])("shared"))).toHaveLength(5)
  })
})
