import { describe, expect, test } from "bun:test"
import { buildMarkdownUrl, buildSourceUrl, resolveSourceRepository } from "./source-url"

const repo = { owner: "acme", name: "docs", ref: "main", docsPath: "packages/guide" }

describe("source repository URLs", () => {
  test("preserves docs-relative nested paths, refs, and extensions with component encoding", () => {
    expect(buildSourceUrl({ ...repo, ref: "feature/new docs#1" }, "guides/a b%?#.mdx")).toBe(
      "https://github.com/acme/docs/blob/feature%2Fnew%20docs%231/packages/guide/guides/a%20b%25%3F%23.mdx"
    )
    expect(buildSourceUrl({ ...repo, owner: "my org", name: "a#repo" }, "index.md")).toBe(
      "https://github.com/my%20org/a%23repo/blob/main/packages/guide/index.md"
    )
    expect(buildSourceUrl(repo, "packages/guide/nested/index.md")).toBe(
      "https://github.com/acme/docs/blob/main/packages/guide/packages/guide/nested/index.md"
    )
    expect(buildSourceUrl(repo, "nested\\README.mdx")).toBe(
      "https://github.com/acme/docs/blob/main/packages/guide/nested/README.mdx"
    )
  })

  test("supports root docs, defaults, and does not manufacture links to non-markdown sources", () => {
    expect(buildSourceUrl({ owner: "acme", name: "docs" }, "index.md")).toBe(
      "https://github.com/acme/docs/blob/main/docs/index.md"
    )
    expect(buildSourceUrl({ ...repo, docsPath: "" }, "README.md")).toBe(
      "https://github.com/acme/docs/blob/main/README.md"
    )
    expect(buildSourceUrl(null, "README.md")).toBeNull()
    expect(buildSourceUrl(repo, undefined)).toBeNull()
    expect(buildSourceUrl(repo, "landing.tsx")).toBeNull()
    expect(buildSourceUrl(repo, "guide")).toBeNull()
    expect(buildSourceUrl(repo, "../secret.md")).toBeNull()
    expect(buildSourceUrl(repo, "./guide.md")).toBeNull()
  })

  test("uses explicit config before fetched metadata; no guessing for a local source", () => {
    const source = {
      type: "github" as const,
      repo: { owner: "fetched", repo: "source", ref: "v1/docs", docsPath: "" },
    }
    expect(resolveSourceRepository(repo, source)).toBe(repo)
    expect(buildSourceUrl(resolveSourceRepository(null, source), "nested/README.md")).toBe(
      "https://github.com/fetched/source/blob/v1%2Fdocs/nested/README.md"
    )
    expect(resolveSourceRepository(null, { type: "local" })).toBeNull()
    expect(resolveSourceRepository(null, { type: "github" })).toBeNull()
  })
})

describe("generated markdown URLs", () => {
  test("keeps source filenames instead of guessing from the route", () => {
    expect(buildMarkdownUrl({ sourcePath: "deploy/index.mdx" })).toBe("/llms/deploy/index.md")
    expect(buildMarkdownUrl({ sourcePath: "README.md" })).toBe("/llms/README.md")
    expect(buildMarkdownUrl({ sourcePath: "nested/a b#%.MDX" })).toBe("/llms/nested/a%20b%23%25.md")
  })

  test("honors base and custom llms directories", () => {
    expect(
      buildMarkdownUrl({
        sourcePath: "deploy/index.mdx",
        basePath: "/gittydocs/",
        llms: { path: "/ai/markdown/" },
      })
    ).toBe("/gittydocs/ai/markdown/deploy/index.md")
    expect(
      buildMarkdownUrl({ sourcePath: "index.md", basePath: "/gittydocs", llms: { path: "  /  " } })
    ).toBe("/gittydocs/llms/index.md")
  })

  test("hides disabled output and pages without markdown sources", () => {
    expect(buildMarkdownUrl({ sourcePath: "index.md", llms: { enabled: false } })).toBeNull()
    expect(buildMarkdownUrl({ sourcePath: "landing.tsx" })).toBeNull()
    expect(buildMarkdownUrl({ sourcePath: "../secret.md" })).toBeNull()
    expect(buildMarkdownUrl({ sourcePath: "index.md", llms: { path: "../private" } })).toBeNull()
    expect(buildMarkdownUrl({})).toBeNull()
  })
})
