import { afterEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const roots: string[] = []
const scriptPath = path.resolve(import.meta.dir, "../prepare-docs.ts")
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

async function fixture(config: unknown, files: Record<string, string> = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "gittydocs-prepare-"))
  roots.push(root)
  const docsDir = path.join(root, "original", "docs")
  const runtimeDir = path.join(root, "cached-runtime")
  await fs.mkdir(docsDir, { recursive: true })
  await fs.mkdir(runtimeDir)
  await fs.writeFile(path.join(docsDir, "gittydocs.jsonc"), JSON.stringify(config))
  const allFiles = {
    "original/docs/index.mdx": "---\ntitle: Welcome\n---\n\n# Welcome\n",
    ...files,
  }
  for (const [name, content] of Object.entries(allFiles)) {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true })
    await fs.writeFile(path.join(root, name), content)
  }
  const run = () => {
    const result = Bun.spawnSync([process.execPath, scriptPath], {
      cwd: runtimeDir,
      env: { ...process.env, GITTYDOCS_SOURCE: docsDir },
      stdout: "pipe",
      stderr: "pipe",
    })
    return {
      code: result.exitCode,
      stderr: result.stderr.toString(),
      stdout: result.stdout.toString(),
    }
  }
  return { root, runtimeDir, docsDir, run }
}

describe("prepare-docs integration (isolated runtime)", () => {
  test("runtime emits only resolved version string using original config folder", async () => {
    const { root, runtimeDir, run } = await fixture(
      { site: { name: "Test", version: { packageJson: "../package.json" } } },
      {
        "original/package.json": '{"version":"1.2.3"}',
        "cached-runtime/package.json": '{"version":"wrong"}',
      }
    )
    expect(run().code).toBe(0)
    const generated = await fs.readFile(
      path.join(runtimeDir, "src/gittydocs/lib/docs/config.gen.ts"),
      "utf-8"
    )
    expect(generated).toContain('"version": "1.2.3"')
    expect(generated).not.toContain("packageJson")
    expect(generated).not.toContain("package.json")
    expect(
      JSON.parse(
        await fs.readFile(path.join(runtimeDir, ".gittydocs-version-manifests.json"), "utf-8")
      )
    ).toEqual([path.join(root, "original/package.json")])
  })
  test("workspace watcher metadata and refreshed inherited versions", async () => {
    const { root, runtimeDir, run } = await fixture(
      { site: { name: "Test", version: { cargoToml: "../crates/member/Cargo.toml" } } },
      {
        "original/Cargo.toml": '[workspace.package]\nversion = "2.3.4"',
        "original/crates/member/Cargo.toml": "[package]\nversion.workspace = true",
      }
    )
    expect(run().code).toBe(0)
    const metadata = JSON.parse(
      await fs.readFile(path.join(runtimeDir, ".gittydocs-version-manifests.json"), "utf-8")
    )
    expect(metadata).toContain(path.join(root, "original/Cargo.toml"))
    expect(metadata).toContain(path.join(root, "original/crates/member/Cargo.toml"))
    await fs.writeFile(
      path.join(root, "original/Cargo.toml"),
      '[workspace.package]\nversion = "2.3.5"'
    )
    expect(run().code).toBe(0)
    expect(
      await fs.readFile(path.join(runtimeDir, "src/gittydocs/lib/docs/config.gen.ts"), "utf-8")
    ).toContain('"version": "2.3.5"')
  })
  test("converts Markdown exports and preserves deeply nested llms hierarchy", async () => {
    const code = '```mdx\n<Steps><Step title="Example">Keep example</Step></Steps>\n```'
    const { runtimeDir, run } = await fixture(
      {
        site: { name: "Test" },
        nav: [
          {
            label: "Guides",
            items: [
              {
                label: "Level 2",
                items: [{ label: "Level 3", items: [{ label: "Deep", path: "/deep" }] }],
              },
            ],
          },
        ],
      },
      {
        "original/docs/deep.mdx": `---\ntitle: Deep page\n---\n\n<Steps><Step title="Install">Run it.\n${code}\n</Step></Steps>\n<Files><Folder name="src"><File name="index.ts" /></Folder></Files>\n<Accordions><Accordion title="Details">Useful.</Accordion></Accordions>\n<Custom>Keep JSX</Custom>`,
      }
    )
    expect(run().code).toBe(0)
    const toc = await fs.readFile(path.join(runtimeDir, "public/llms.txt"), "utf-8")
    expect(toc).toContain("### Guides\n- Level 2\n  - Level 3\n    - [Deep page](/llms/deep.md)")
    const exported = await fs.readFile(path.join(runtimeDir, "public/llms/deep.md"), "utf-8")
    expect(exported).toContain("# Deep page\n\n### 1. Install")
    expect(exported).toContain("  - `index.ts`")
    expect(exported).toContain("### Details")
    expect(exported).toContain("<Custom>Keep JSX</Custom>")
    expect(exported).toContain(code)
  })
  test("llms disabled removes existing exports", async () => {
    const { runtimeDir, run } = await fixture(
      { llms: { enabled: false, path: "ai" } },
      { "cached-runtime/public/llms.txt": "old", "cached-runtime/public/ai/index.md": "old" }
    )
    expect(run().code).toBe(0)
    expect(
      await fs.access(path.join(runtimeDir, "public/llms.txt")).then(
        () => true,
        () => false
      )
    ).toBe(false)
    expect(
      await fs.access(path.join(runtimeDir, "public/ai")).then(
        () => true,
        () => false
      )
    ).toBe(false)
  })
  test("missing manifest errors name original file and metadata supports recovery", async () => {
    const { root, runtimeDir, run } = await fixture({
      site: { name: "Test", version: { packageJson: "../package.json" } },
    })
    const result = run()
    expect(result.code).toBe(1)
    expect(result.stderr).toContain(path.join(root, "original/package.json"))
    expect(result.stderr).toContain("original docs/config folder")
    expect(
      JSON.parse(
        await fs.readFile(path.join(runtimeDir, ".gittydocs-version-manifests.json"), "utf-8")
      )
    ).toContain(path.join(root, "original/package.json"))
  })
})
