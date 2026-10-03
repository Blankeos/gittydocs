import { describe, expect, test } from "bun:test"
import type { NavItem } from "./config-schema"
import {
  buildNavFromPages,
  createDocsNavigation,
  formatVersionLabel,
  isExternalHref,
  isInternalHref,
  isSafeNavHref,
  normalizeMdxSourcePath,
  normalizeNavPath,
  opensInNewTab,
} from "./nav-utils"

describe("navigation destinations", () => {
  const pages = ["/intro", "/nested/start", "/other"].map((routePath) => ({
    routePath,
    title: routePath,
  }))

  test("finds the first known internal descendant through pathless groups", () => {
    const group: NavItem = {
      label: "Docs",
      items: [
        { label: "External", path: "https://example.com" },
        { label: "Missing", path: "/missing" },
        { label: "Empty", items: [] },
        { label: "Nested", items: [{ label: "Start", path: "/nested/start" }] },
        { label: "Intro", path: "/intro" },
      ],
    }
    const navigation = createDocsNavigation(pages, [group])
    expect(navigation.destination(navigation.items[0])).toBe("/nested/start")
    expect(navigation.resolve("/nested/start").trail.map((item) => item.label)).toEqual([
      "Docs",
      "Nested",
      "Start",
    ])
  })

  test("explicit invalid landings never redirect to a valid child", () => {
    for (const path of [
      "/missing",
      "https://example.com",
      "#intro",
      "?q=intro",
      "javascript:alert(1)",
      "/intro\n",
      "/intro%250a",
      "/llms.txt",
    ]) {
      const group = { label: "Docs", path, items: [{ label: "Intro", path: "/intro" }] }
      expect(createDocsNavigation(pages, [group]).destination(group)).toBeUndefined()
    }
    const group = { label: "Docs", path: "/other", items: [{ label: "Intro", path: "/intro" }] }
    expect(createDocsNavigation(pages, [group]).destination(group)).toBe("/other")
  })

  test("trims ordinary whitespace while retaining base paths, queries and fragments in hrefs", () => {
    const group = {
      label: "Docs",
      items: [{ label: "Intro", path: " /base/intro/?mode=all#usage " }],
    }
    const navigation = createDocsNavigation(pages, [group], "/base/")
    expect(navigation.destination(group)).toBe("/base/intro/?mode=all#usage")
    expect(navigation.resolve(" /base/intro///?mode=all#usage ")).toMatchObject({
      routePath: "/intro",
      page: pages[0],
      item: group.items[0],
      order: 0,
    })
  })
})

describe("automatic navigation", () => {
  test("removes exactly the MDX collection prefix", () => {
    expect(normalizeMdxSourcePath("docs/foo.mdx")).toBe("foo.mdx")
    expect(normalizeMdxSourcePath("docs/docs/foo.mdx")).toBe("docs/foo.mdx")
    expect(normalizeMdxSourcePath("docs-guide/foo.mdx")).toBe("docs-guide/foo.mdx")
    expect(normalizeMdxSourcePath("guides/docs/foo.mdx")).toBe("guides/docs/foo.mdx")
    expect(normalizeMdxSourcePath("foo.mdx")).toBe("foo.mdx")
  })

  test("uses known routes/titles for recursive MDX and unchanged custom source paths", () => {
    const mdxPages = [
      { sourcePath: "docs/index.mdx", routePath: "/", title: "Welcome" },
      { sourcePath: "docs/foo.mdx", routePath: "/foo", title: "First page" },
      { sourcePath: "docs/guides/2-setup.mdx", routePath: "/guides/2-setup", title: "Setup" },
      { sourcePath: "docs/guides/1-start.mdx", routePath: "/guides/1-start", title: "Start" },
      { sourcePath: "docs/docs/foo.mdx", routePath: "/docs/foo", title: "Nested docs" },
    ].map((page) => ({ ...page, sourcePath: normalizeMdxSourcePath(page.sourcePath) }))
    const customPage = { sourcePath: "docs/custom.tsx", routePath: "/docs/custom", title: "Custom" }
    const pages = [...mdxPages, customPage]
    const automaticNav = buildNavFromPages(pages)
    expect(automaticNav).toEqual([
      { label: "Welcome", path: "/" },
      {
        label: "Docs",
        items: [
          { label: "Custom", path: "/docs/custom" },
          { label: "Nested docs", path: "/docs/foo" },
        ],
      },
      { label: "First page", path: "/foo" },
      {
        label: "Guides",
        items: [
          { label: "Start", path: "/guides/1-start" },
          { label: "Setup", path: "/guides/2-setup" },
        ],
      },
    ])
    expect(customPage.sourcePath).toBe("docs/custom.tsx")
    const navigation = createDocsNavigation(pages, automaticNav)
    for (const page of pages) {
      const resolved = navigation.resolve(page.routePath)
      expect(resolved.page).toBe(page)
      expect(resolved.item).toEqual({ label: page.title, path: page.routePath })
      expect(resolved.order).toBeDefined()
    }
  })

  test("uses the page route rather than guessing a route from the filename", () => {
    expect(
      buildNavFromPages([{ sourcePath: "guides/readme.mdx", routePath: "/guides", title: "Guide" }])
    ).toEqual([{ label: "Guides", items: [{ label: "Guide", path: "/guides" }] }])
    expect(buildNavFromPages([])).toEqual([])
  })

  test("leaves configured navigation unchanged", () => {
    const configured = [{ label: "Custom nav", path: "/custom" }]
    expect(buildNavFromPages([], configured)).toBe(configured)
    expect(buildNavFromPages([], [])).toEqual([])
  })
})

test("version labels have one v prefix", () => {
  expect(formatVersionLabel("0.2.1")).toBe("v0.2.1")
  expect(formatVersionLabel("v0.2.1")).toBe("v0.2.1")
  expect(formatVersionLabel("V1.0.0-beta")).toBe("V1.0.0-beta")
})

const nav: NavItem[] = [
  {
    label: "Guides",
    path: "/guides",
    items: [
      { label: "Overview", path: "/guides/overview" },
      {
        label: "Reference",
        items: [{ label: "Overview", path: "/guides/reference/overview/" }],
      },
    ],
  },
  {
    label: "Guides",
    items: [
      {
        label: "Reference",
        items: [{ label: "Overview", path: "/api/reference/overview" }],
      },
    ],
  },
  { label: "GitHub", path: "https://github.com/example/docs" },
]

describe("navigation resolution", () => {
  const pages = [
    "/guides",
    "/guides/overview",
    "/guides/reference/overview",
    "/api/reference/overview",
    "/hidden",
  ].map((routePath) => ({ routePath, title: routePath }))

  test("returns exact ancestry and original identities even with repeated labels", () => {
    const navigation = createDocsNavigation(pages, nav)
    const resolved = navigation.resolve("api/reference/overview///?mode=all#examples")
    expect(resolved.routePath).toBe("/api/reference/overview")
    expect(resolved.page).toBe(pages[3])
    expect(resolved.trail.map((item) => item.label)).toEqual(["Guides", "Reference", "Overview"])
    expect(resolved.trail[0]).toBe(nav[1])
    expect(resolved.trail[1]).toBe(nav[1].items![0])
    expect(resolved.item).toBe(nav[1].items![0].items![0])
    expect(navigation.resolve("/guides/").trail).toEqual([nav[0]])
    expect(navigation.items[0]).toBe(nav[0])
  })

  test("orders known pages depth-first with landing pages before children", () => {
    const navigation = createDocsNavigation(pages, nav)
    for (const [order, page] of pages.slice(0, 4).entries()) {
      const resolved = navigation.resolve(page.routePath)
      expect(resolved.order).toBe(order)
      expect(resolved.previous?.routePath).toBe(pages[order - 1]?.routePath)
      expect(resolved.next?.routePath).toBe(order < 3 ? pages[order + 1].routePath : undefined)
    }
    expect(navigation.resolve("/guides").next?.item).toBe(nav[0].items![0])
  })

  test("known pages absent from nav remain resolvable without fabricated ancestry or adjacency", () => {
    for (const configured of [nav, []]) {
      const resolved = createDocsNavigation(pages, configured).resolve("/hidden")
      expect(resolved.page).toBe(pages[4])
      expect(resolved.trail).toEqual([])
      expect(resolved.item).toBeUndefined()
      expect(resolved.order).toBeUndefined()
      expect(resolved.previous).toBeUndefined()
      expect(resolved.next).toBeUndefined()
    }
  })

  test("normalizes BASE_URL page and nav routes only at segment boundaries", () => {
    const basedPages = [
      { routePath: " /docs/introduction/ ", title: "Intro" },
      { routePath: "/docs-guide", title: "Other" },
    ]
    const basedNav = [
      { label: "Intro", path: " /introduction/ " },
      { label: "Other", path: "/docs-guide" },
    ]
    const navigation = createDocsNavigation(basedPages, basedNav, "/docs/")
    for (const path of ["/introduction", " /docs/introduction/?q=1#intro "]) {
      expect(navigation.resolve(path)).toMatchObject({
        routePath: "/introduction",
        page: basedPages[0],
        item: basedNav[0],
      })
    }
    expect(navigation.resolve("/docs-guide").page).toBe(basedPages[1])
    expect(navigation.resolve("/docs").page).toBeUndefined()
  })

  test("deduplicates normalized nav and page routes using their first occurrence", () => {
    const duplicatePages = [
      { routePath: "/same", title: "First page" },
      { routePath: "/same/", title: "Duplicate page" },
      { routePath: "/next", title: "Next" },
    ]
    const duplicates = [
      { label: "First", path: " /same/?q=1#intro " },
      { label: "Second", path: "/same/" },
      { label: "Next", path: "/next" },
    ]
    const navigation = createDocsNavigation(duplicatePages, duplicates)
    expect(navigation.resolve("/same")).toMatchObject({
      page: duplicatePages[0],
      item: duplicates[0],
      trail: [duplicates[0]],
      order: 0,
      next: { item: duplicates[2], routePath: "/next" },
    })
    expect(navigation.resolve("/next").previous?.item).toBe(duplicates[0])
    expect(navigation.resolve("/next").order).toBe(1)
  })

  test("filters unsafe children and llms nav without mutating the input", () => {
    const child = { label: "Intro", path: "/intro" }
    const group = {
      label: "Docs",
      items: [
        child,
        { label: "Unsafe", path: "/intro%250a" },
        { label: "LLMs", path: "/llms.txt" },
      ],
    }
    const navigation = createDocsNavigation(
      [
        { routePath: "/intro", title: "Intro" },
        { routePath: "/llms.txt", title: "LLMs" },
      ],
      [group, { label: "Empty", items: [] }]
    )
    expect(navigation.items).toEqual([{ label: "Docs", items: [child] }])
    expect(navigation.items[0]).not.toBe(group)
    expect(navigation.items[0].items![0]).toBe(child)
    expect(group.items).toHaveLength(3)
    expect(navigation.resolve("/intro").trail[0]).toBe(navigation.items[0])
    expect(navigation.resolve("/llms.txt").order).toBeUndefined()
  })

  test("rejects unsafe and non-route identities, while missing routes do not gain adjacency", () => {
    const navigation = createDocsNavigation(pages, [...nav, { label: "Missing", path: "/missing" }])
    for (const path of [
      "https://github.com/example/docs",
      "//example.com",
      "mailto:a@b.com",
      "#overview",
      "?q=docs",
      "",
      "\n/guides",
      "/guides%0a",
      "javascript%3Aalert(1)",
    ]) {
      const resolved = navigation.resolve(path)
      expect(resolved.page).toBeUndefined()
      expect(resolved.trail).toEqual([])
      expect(resolved.order).toBeUndefined()
      expect(resolved.previous).toBeUndefined()
      expect(resolved.next).toBeUndefined()
    }
    expect(navigation.resolve("/missing")).toMatchObject({
      trail: [{ label: "Missing", path: "/missing" }],
      page: undefined,
      order: undefined,
      previous: undefined,
      next: undefined,
    })
    expect(navigation.resolve("/guides/missing").trail).toEqual([])
  })
})

describe("URL handling", () => {
  test("allows safe routes, fragments, queries and supported link protocols", () => {
    for (const href of [
      "/",
      "/guide?q=1#intro",
      "guide/intro",
      "./guide",
      "../guide",
      "/api/name:method",
      "/guides/%E4%B8%AD%E6%96%87",
      " /guide ",
      "#intro",
      "?q=docs",
      "https://example.com/a?q=1#intro",
      "HTTP://example.com",
      " //example.com/path ",
      "mailto:docs@example.com?subject=Docs%20help",
      "tel:+123456789",
    ]) {
      expect(isSafeNavHref(href)).toBe(true)
    }
  })

  test("rejects dangerous/unsupported schemes and encoded bypasses", () => {
    for (const href of [
      "javascript:alert(1)",
      " JaVaScRiPt:alert(1) ",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "ftp://example.com",
      "https:guide",
      "javascript%3Aalert(1)",
      "%6Aavascript:alert(1)",
      "%256Aavascript%253Aalert(1)",
      "%20javascript%3Aalert(1)",
      "\\\\example.com",
      "/\\example.com",
      "/%5cexample.com",
      "https://example.com\\@evil.com",
      "https://",
      "mailto:",
      "tel:",
      "",
      "   ",
    ]) {
      expect(isSafeNavHref(href)).toBe(false)
    }
  })

  test("rejects raw or encoded controls anywhere, including surrounding newlines", () => {
    for (const href of [
      "java\nscript:alert(1)",
      "java\tscript:alert(1)",
      "java\rscript:alert(1)",
      "\n/guide",
      "/guide\n",
      "/guide\0intro",
      "https://example.com/\u007f",
      "/guide\u0085intro",
      "java%0ascript:alert(1)",
      "java%2509script%253Aalert(1)",
      "/guide%00intro",
      "/guide%7fintro",
      "/guide%C2%85intro",
      "/guide%0a%ff",
      "#intro%0d",
      "?q=%0a",
    ]) {
      expect(isSafeNavHref(href)).toBe(false)
    }
  })

  test("detects HTTP(S) URLs case-insensitively, including protocol-relative URLs", () => {
    for (const path of [
      "http://example.com",
      "HTTPS://example.com/path?q=1#x",
      " //example.com/a ",
    ]) {
      expect(isExternalHref(path)).toBe(true)
      expect(isInternalHref(path)).toBe(false)
    }
    for (const path of [
      "/https-guide",
      "guides/http",
      "/",
      "mailto:docs@example.com",
      "https:guide",
    ]) {
      expect(isExternalHref(path)).toBe(false)
    }
  })

  test("excludes non-route URL schemes and fragment/query-only links", () => {
    for (const path of [
      "mailto:a@b.com",
      "tel:123",
      "javascript:alert(1)",
      "data:text/plain,hello",
      "#intro",
      "?q=docs",
      "",
      "\\\\example.com",
      "/\\example.com",
    ]) {
      expect(isInternalHref(path)).toBe(false)
    }
    expect(isInternalHref("/guide?q=1#intro")).toBe(true)
    expect(isInternalHref("guide/intro")).toBe(true)
  })

  test("defaults external links to a new tab and honors explicit opt-in/out", () => {
    expect(opensInNewTab({ label: "External", path: "https://example.com" })).toBe(true)
    expect(opensInNewTab({ label: "External", path: "http://example.com", newTab: false })).toBe(
      false
    )
    expect(opensInNewTab({ label: "Internal", path: "/guide" })).toBe(false)
    expect(opensInNewTab({ label: "Internal", path: "/guide", newTab: true })).toBe(true)
    expect(opensInNewTab({ label: "LLMs", path: "/llms.txt", newTab: true })).toBe(true)
    expect(opensInNewTab({ label: "Group" })).toBe(false)
    expect(opensInNewTab({ label: "Email", path: "mailto:docs@example.com" })).toBe(false)
  })

  test("normalizes root/relative routes and strips bases only at segment boundaries", () => {
    expect(normalizeNavPath("")).toBe("/")
    expect(normalizeNavPath("/")).toBe("/")
    expect(normalizeNavPath(" guide/start///?q=1#example ")).toBe("/guide/start")
    expect(normalizeNavPath("/docs/", "/docs/")).toBe("/")
    expect(normalizeNavPath("/docs", "/docs/")).toBe("/")
    expect(normalizeNavPath("/docs/guide/", "/docs/")).toBe("/guide")
    expect(normalizeNavPath("/docs-guide/", "/docs/")).toBe("/docs-guide")
    expect(normalizeNavPath("/docs2/guide", "/docs/")).toBe("/docs2/guide")
  })

  test("never rewrites absolute URLs into internal paths", () => {
    const url = "https://example.com/docs/guide/?q=1#intro"
    expect(normalizeNavPath(url, "/docs/")).toBe(url)
    expect(normalizeNavPath("//example.com/docs/", "/docs/")).toBe("//example.com/docs/")
    expect(normalizeNavPath("mailto:docs@example.com", "/docs/")).toBe("mailto:docs@example.com")
  })
})
