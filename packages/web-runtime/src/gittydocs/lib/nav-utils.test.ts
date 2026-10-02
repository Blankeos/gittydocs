import { describe, expect, test } from "bun:test"
import type { NavItem } from "./config-schema"
import {
  buildNavFromPages,
  findNavTrail,
  flattenNav,
  formatVersionLabel,
  isExternalHref,
  isInternalHref,
  isSafeNavHref,
  normalizeMdxSourcePath,
  normalizeNavPath,
  opensInNewTab,
  resolveNavPagePath,
} from "./nav-utils"

describe("implicit section landing pages", () => {
  const pages = ["/intro", "/nested/start", "/other"]
  test("links to the first known internal descendant in navigation order", () => {
    expect(
      resolveNavPagePath(
        {
          label: "Docs",
          items: [
            { label: "External", path: "https://example.com" },
            { label: "Missing", path: "/missing" },
            { label: "Intro", path: "/intro" },
            { label: "Other", path: "/other" },
          ],
        },
        pages
      )
    ).toBe("/intro")
  })
  test("recurses through nested groups", () => {
    expect(
      resolveNavPagePath(
        {
          label: "Docs",
          items: [
            { label: "Empty", items: [] },
            { label: "Nested", items: [{ label: "Start", path: "/nested/start" }] },
          ],
        },
        pages
      )
    ).toBe("/nested/start")
  })
  test("honors explicit paths rather than redirecting broken or external landings", () => {
    expect(
      resolveNavPagePath(
        { label: "Docs", path: "/other", items: [{ label: "Intro", path: "/intro" }] },
        pages
      )
    ).toBe("/other")
    expect(
      resolveNavPagePath(
        { label: "Docs", path: "/missing", items: [{ label: "Intro", path: "/intro" }] },
        pages
      )
    ).toBeUndefined()
    expect(
      resolveNavPagePath(
        { label: "Docs", items: [{ label: "Unsafe", path: "javascript:alert(1)" }] },
        pages
      )
    ).toBeUndefined()
  })
  test("supports base paths and keeps fragments without inferring llms landings", () => {
    expect(
      resolveNavPagePath(
        { label: "Docs", items: [{ label: "Intro", path: "/base/intro/#usage" }] },
        pages,
        "/base/"
      )
    ).toBe("/base/intro/#usage")
    expect(
      resolveNavPagePath({ label: "Docs", items: [{ label: "LLMs", path: "/llms.txt" }] }, [
        "/llms.txt",
      ])
    ).toBeUndefined()
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
    for (const page of pages) {
      const trail = findNavTrail(automaticNav, page.routePath)
      expect(trail[trail.length - 1]).toEqual({ label: page.title, path: page.routePath })
    }
    expect(flattenNav(automaticNav).filter((item) => item.path)).toHaveLength(pages.length)
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

describe("findNavTrail", () => {
  test("returns the exact nested ancestry even when labels repeat", () => {
    const trail = findNavTrail(nav, "/api/reference/overview/")
    expect(trail.map((item) => item.label)).toEqual(["Guides", "Reference", "Overview"])
    expect(trail[0]).toBe(nav[1])
    expect(trail[1]).toBe(nav[1].items![0])
    expect(trail[2]).toBe(nav[1].items![0].items![0])
  })

  test("matches a group landing without adding its children", () => {
    expect(findNavTrail(nav, "/guides/")).toEqual([nav[0]])
  })

  test("normalizes routes, trailing slashes, query strings and fragments", () => {
    expect(findNavTrail(nav, "guides/reference/overview///?mode=all#examples")).toEqual([
      nav[0],
      nav[0].items![1],
      nav[0].items![1].items![0],
    ])
  })

  test("strips a deployment base from both current and configured routes", () => {
    expect(findNavTrail(nav, "/docs/api/reference/overview/", "/docs/")[0]).toBe(nav[1])
    const basedNav = [{ label: "Introduction", path: "/docs/introduction/" }]
    expect(findNavTrail(basedNav, "/introduction", "/docs/")).toEqual(basedNav)
    expect(findNavTrail(nav, "/docs", "/docs/")).toEqual([])
  })

  test("does not use prefix, label, or external URL matches", () => {
    expect(findNavTrail(nav, "/guides/missing")).toEqual([])
    expect(findNavTrail(nav, "/unknown")).toEqual([])
    expect(findNavTrail(nav, "https://github.com/example/docs")).toEqual([])
    expect(findNavTrail(nav, "#overview")).toEqual([])
    expect(findNavTrail(nav, "")).toEqual([])
  })

  test("uses the first exact duplicate route in nav order", () => {
    const duplicates = [
      { label: "First", path: "/same" },
      { label: "Second", path: "/same/" },
    ]
    expect(findNavTrail(duplicates, "/same")).toEqual([duplicates[0]])
  })
})

describe("flattenNav", () => {
  test("preserves pre-order, group landings, pathless groups and original identity", () => {
    const flattened = flattenNav(nav)
    expect(flattened.map((item) => item.path)).toEqual([
      "/guides",
      "/guides/overview",
      undefined,
      "/guides/reference/overview/",
      undefined,
      undefined,
      "/api/reference/overview",
      "https://github.com/example/docs",
    ])
    expect(flattened[0]).toBe(nav[0])
    expect(flattened[6]).toBe(nav[1].items![0].items![0])
    expect(nav[0].items).toHaveLength(2)
  })

  test("handles empty nav and empty child arrays", () => {
    expect(flattenNav([])).toEqual([])
    const emptyGroup = { label: "Empty", items: [] }
    expect(flattenNav([emptyGroup])).toEqual([emptyGroup])
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
