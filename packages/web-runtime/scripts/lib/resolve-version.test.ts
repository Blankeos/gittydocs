import { afterEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { docsConfigSchema } from "../../src/gittydocs/lib/config-schema"
import { resolveSiteVersion, type VersionSource } from "./resolve-version"

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})
async function fixture(files: Record<string, string>) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "gittydocs-version-"))
  roots.push(root)
  await fs.mkdir(path.join(root, "docs"))
  for (const [name, content] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true })
    await fs.writeFile(path.join(root, name), content)
  }
  return { root, source: { type: "local", docsDir: path.join(root, "docs") } as const }
}

describe("site.version schema", () => {
  test("strict manifest inputs and nonempty strings", () => {
    for (const version of [
      "",
      "  ",
      {},
      { packageJson: "" },
      { cargoToml: " " },
      { packageJson: "../package.json", cargoToml: "../Cargo.toml" },
      { packageJson: "../package.json", extra: true },
    ]) {
      expect(docsConfigSchema.safeParse({ site: { name: "Docs", version } }).success).toBe(false)
    }
    expect(
      docsConfigSchema.parse({
        site: { name: "Docs", version: "v1.0" },
        ui: { breadcrumbs: false, pageNavigation: true },
        nav: [
          {
            label: "Guide",
            icon: "book",
            newTab: true,
            defaultOpen: true,
            accordion: true,
            items: [{ label: "Nested", items: [{ label: "Page", path: "/page", icon: "file" }] }],
          },
        ],
      }).nav?.[0].items?.[0].items?.[0].icon
    ).toBe("file")
  })
})

describe("resolveSiteVersion local", () => {
  test("undefined and literals need no manifest", async () => {
    const source = { type: "local", docsDir: "/does/not/exist" } as const
    expect(await resolveSiteVersion(undefined, source)).toEqual({
      version: undefined,
      manifestPaths: [],
    })
    expect(await resolveSiteVersion(" v1.2.3 ", source)).toEqual({
      version: "v1.2.3",
      manifestPaths: [],
    })
    await expect(resolveSiteVersion(" ", source)).rejects.toThrow("Invalid site.version")
  })
  test("reads top-level JSON version relative to original docs, not cwd", async () => {
    const { root, source } = await fixture({
      "package.json": '{"version":"2.3.4", "nested":{"version":"wrong"}}',
    })
    expect(await resolveSiteVersion({ packageJson: "../package.json" }, source)).toEqual({
      version: "2.3.4",
      manifestPaths: [path.join(root, "package.json")],
    })
  })
  test("Cargo strings, dotted keys, inline tables, comments and quoted keys", async () => {
    const { root, source } = await fixture({
      "Cargo.toml": "[package]\nname = \"test\"\nversion = '1.2.3' # comment\n",
    })
    expect((await resolveSiteVersion({ cargoToml: "../Cargo.toml" }, source)).version).toBe("1.2.3")
    for (const contents of [
      'package = { name = "test", version = "2.0.0" }',
      '["package"]\n"version" = "3.0.0"',
    ]) {
      await fs.writeFile(path.join(root, "Cargo.toml"), contents)
      expect((await resolveSiteVersion({ cargoToml: "../Cargo.toml" }, source)).version).toMatch(
        /^[23]\.0\.0$/
      )
    }
  })
  test("inherits workspace version and tracks member and ancestor manifests", async () => {
    const { root, source } = await fixture({
      "Cargo.toml":
        '[workspace]\nmembers = ["crates/member"]\n[workspace.package]\nversion = "4.5.6"',
      "crates/member/Cargo.toml": '[package]\nname = "member"\nversion.workspace = true',
    })
    const result = await resolveSiteVersion({ cargoToml: "../crates/member/Cargo.toml" }, source)
    expect(result.version).toBe("4.5.6")
    expect(result.manifestPaths).toEqual(
      ["crates/member/Cargo.toml", "crates/Cargo.toml", "Cargo.toml"].map((file) =>
        path.join(root, file)
      )
    )
  })
  test("inherits inline version table from explicitly located workspace", async () => {
    const { source } = await fixture({
      "workspace/Cargo.toml": '[workspace.package]\nversion = "5.6.7"',
      "member/Cargo.toml": '[package]\nversion = { workspace = true }\nworkspace = "../workspace"',
    })
    expect((await resolveSiteVersion({ cargoToml: "../member/Cargo.toml" }, source)).version).toBe(
      "5.6.7"
    )
  })
  test("supports workspace version in same manifest and multiline TOML", async () => {
    const { source } = await fixture({
      "Cargo.toml":
        '[package]\nversion.workspace = true\n[workspace.package]\nversion = """6.7.8"""',
    })
    expect((await resolveSiteVersion({ cargoToml: "../Cargo.toml" }, source)).version).toBe("6.7.8")
  })
  test("actionable malformed, missing version, missing file and wrong basename errors", async () => {
    const { root, source } = await fixture({
      "package.json": "bad",
      "Cargo.toml": '[package]\nversion = "oops',
    })
    await expect(resolveSiteVersion({ packageJson: "../package.json" }, source)).rejects.toThrow(
      "Invalid JSON"
    )
    await expect(resolveSiteVersion({ cargoToml: "../Cargo.toml" }, source)).rejects.toThrow(
      "Invalid TOML"
    )
    for (const contents of [
      "{}",
      '{"version":42}',
      '{"version":" "}',
      '{"nested":{"version":"1"}}',
    ]) {
      await fs.writeFile(path.join(root, "package.json"), contents)
      await expect(resolveSiteVersion({ packageJson: "../package.json" }, source)).rejects.toThrow(
        "top-level version"
      )
    }
    await expect(
      resolveSiteVersion({ packageJson: "missing/package.json" }, source)
    ).rejects.toThrow("original docs/config folder")
    await expect(resolveSiteVersion({ packageJson: "../other.json" }, source)).rejects.toThrow(
      "point to a package.json"
    )
    await expect(resolveSiteVersion({ cargoToml: "../cargo.toml" }, source)).rejects.toThrow(
      "point to a Cargo.toml"
    )
  })
  test("rejects invalid Cargo inheritance and missing workspace version", async () => {
    const { root, source } = await fixture({
      "Cargo.toml": "[package]\nversion.workspace = true\n[workspace]\n",
      "member/Cargo.toml": "[package]\nversion = 1",
    })
    await expect(resolveSiteVersion({ cargoToml: "../Cargo.toml" }, source)).rejects.toThrow(
      "[workspace.package].version"
    )
    await expect(resolveSiteVersion({ cargoToml: "../member/Cargo.toml" }, source)).rejects.toThrow(
      "[package].version"
    )
    await fs.writeFile(
      path.join(root, "member/Cargo.toml"),
      '[package]\nversion.workspace = true\nworkspace = "../missing"'
    )
    await expect(resolveSiteVersion({ cargoToml: "../member/Cargo.toml" }, source)).rejects.toThrow(
      "Cannot read site.version manifest"
    )
  })
  test("reports candidates before failure to allow watcher recovery", async () => {
    const { root, source } = await fixture({})
    const tracked: string[] = []
    await expect(
      resolveSiteVersion({ packageJson: "../package.json" }, source, {
        onManifest: (file) => tracked.push(file),
      })
    ).rejects.toThrow("Cannot read")
    expect(tracked).toEqual([path.join(root, "package.json")])
  })
})

describe("resolveSiteVersion GitHub", () => {
  const source: VersionSource = {
    type: "github",
    owner: "owner",
    repo: "repo",
    ref: "release/v2",
    docsPath: "guides/docs",
    headers: { Authorization: "Bearer test" },
  }
  function mockFetch(files: Record<string, string>, calls: string[]) {
    return (async (url: string | URL | Request) => {
      const value = String(url)
      calls.push(value)
      const file = decodeURIComponent(value.split("/release%2Fv2/")[1] ?? "")
      return new Response(files[file] ?? "missing", { status: file in files ? 200 : 404 })
    }) as typeof fetch
  }
  test("relative package path uses docsPath and same ref", async () => {
    const calls: string[] = []
    const result = await resolveSiteVersion({ packageJson: "../../package.json" }, source, {
      fetch: mockFetch({ "package.json": '{"version":"7.8.9"}' }, calls),
    })
    expect(result).toEqual({ version: "7.8.9", manifestPaths: ["package.json"] })
    expect(calls).toEqual([
      "https://raw.githubusercontent.com/owner/repo/release%2Fv2/package.json",
    ])
  })
  test("Cargo inheritance searches as far as repository root", async () => {
    const calls: string[] = []
    const result = await resolveSiteVersion({ cargoToml: "../Cargo.toml" }, source, {
      fetch: mockFetch(
        {
          "guides/Cargo.toml": "[package]\nversion.workspace = true",
          "Cargo.toml": '[workspace.package]\nversion = "8.9.0"',
        },
        calls
      ),
    })
    expect(result.version).toBe("8.9.0")
    expect(result.manifestPaths).toEqual(["guides/Cargo.toml", "Cargo.toml"])
  })
  test("rejects escaping/absolute/URL paths without fetching", async () => {
    const calls: string[] = []
    for (const packageJson of [
      "../../../package.json",
      "/package.json",
      "C:\\package.json",
      "..\\package.json",
      "https://example.com/package.json",
    ]) {
      await expect(
        resolveSiteVersion({ packageJson }, source, { fetch: mockFetch({}, calls) })
      ).rejects.toThrow("Invalid site.version manifest path")
    }
    expect(calls).toEqual([])
  })
  test("inherited workspace paths cannot escape the repository", async () => {
    const calls: string[] = []
    await expect(
      resolveSiteVersion({ cargoToml: "../Cargo.toml" }, source, {
        fetch: mockFetch(
          {
            "guides/Cargo.toml": '[package]\nversion.workspace = true\nworkspace = "../../outside"',
          },
          calls
        ),
      })
    ).rejects.toThrow("path escapes the GitHub repository root")
    expect(calls).toHaveLength(1)
  })
  test("missing manifest and missing inherited workspace produce actionable errors", async () => {
    await expect(
      resolveSiteVersion({ packageJson: "../../package.json" }, source, {
        fetch: mockFetch({}, []),
      })
    ).rejects.toThrow("HTTP 404")
    const calls: string[] = []
    await expect(
      resolveSiteVersion({ cargoToml: "../Cargo.toml" }, source, {
        fetch: mockFetch({ "guides/Cargo.toml": "[package]\nversion.workspace = true" }, calls),
      })
    ).rejects.toThrow("no workspace Cargo.toml found")
    expect(calls).toHaveLength(2)
  })
})
