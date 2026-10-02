import { afterEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { startPrepareDocsWatcher } from "../../../cli/src/cli/commands/dev"

const roots: string[] = []
const stops: Array<() => Promise<void>> = []
afterEach(async () => {
  await Promise.all(stops.splice(0).map((stop) => stop()))
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

async function waitFor(check: () => Promise<boolean>) {
  const start = Date.now()
  while (!(await check())) {
    if (Date.now() - start > 7000) throw new Error("Timed out waiting for dev manifest refresh")
    await Bun.sleep(75)
  }
}

async function fixture(version: unknown, files: Record<string, string>) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "gittydocs-watch-"))
  roots.push(root)
  const docsDir = path.join(root, "docs")
  const runtimeDir = path.join(root, "runtime")
  await fs.mkdir(docsDir)
  await fs.mkdir(runtimeDir)
  await fs.writeFile(path.join(docsDir, "index.md"), "# Docs\n")
  await fs.writeFile(
    path.join(docsDir, "gittydocs.json"),
    JSON.stringify({ site: { name: "Test", version }, llms: { enabled: false } })
  )
  await fs.writeFile(
    path.join(runtimeDir, "package.json"),
    JSON.stringify({
      scripts: {
        "prepare:docs": `bun run ${JSON.stringify(path.resolve(import.meta.dir, "../prepare-docs.ts"))}`,
      },
    })
  )
  for (const [name, value] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true })
    await fs.writeFile(path.join(root, name), value)
  }
  const initial = Bun.spawnSync([process.execPath, "run", "prepare:docs"], {
    cwd: runtimeDir,
    env: { ...process.env, GITTYDOCS_SOURCE: docsDir },
    stdout: "pipe",
    stderr: "pipe",
  })
  expect(initial.exitCode).toBe(0)
  const stop = await startPrepareDocsWatcher({
    sourceDir: docsDir,
    sourceValue: docsDir,
    webDir: runtimeDir,
  })
  stops.push(stop)
  await Bun.sleep(200)
  const hasVersion = async (value: string) => {
    try {
      return (
        await fs.readFile(path.join(runtimeDir, "src/gittydocs/lib/docs/config.gen.ts"), "utf-8")
      ).includes(`"version": "${value}"`)
    } catch {
      return false
    }
  }
  return { root, docsDir, runtimeDir, hasVersion }
}

describe("CLI dev version manifest watcher", () => {
  test("refreshes external JSON, updates reference watches, and recovers a deleted manifest", async () => {
    const { root, docsDir, runtimeDir, hasVersion } = await fixture(
      { packageJson: "../package.json" },
      { "package.json": '{"version":"1.0.0"}', "other/package.json": '{"version":"2.0.0"}' }
    )
    await fs.writeFile(path.join(root, "package.json"), '{"version":"1.0.1"}')
    await waitFor(() => hasVersion("1.0.1"))
    await fs.writeFile(
      path.join(docsDir, "gittydocs.json"),
      JSON.stringify({
        site: { name: "Test", version: { packageJson: "../other/package.json" } },
        llms: { enabled: false },
      })
    )
    await waitFor(() => hasVersion("2.0.0"))
    await fs.writeFile(path.join(root, "other/package.json"), '{"version":"2.0.1"}')
    await waitFor(() => hasVersion("2.0.1"))
    const metadataPath = path.join(runtimeDir, ".gittydocs-version-manifests.json")
    const beforeFailure = (await fs.stat(metadataPath)).mtimeMs
    await fs.rm(path.join(root, "other/package.json"))
    await waitFor(async () => (await fs.stat(metadataPath)).mtimeMs > beforeFailure)
    await fs.writeFile(path.join(root, "other/package.json"), '{"version":"2.0.2"}')
    await waitFor(() => hasVersion("2.0.2"))
    expect(await hasVersion("2.0.2")).toBe(true)
  }, 20000)

  test("refreshes external inherited workspace Cargo version", async () => {
    const { root, hasVersion } = await fixture(
      { cargoToml: "../crates/member/Cargo.toml" },
      {
        "Cargo.toml": '[workspace.package]\nversion = "3.0.0"',
        "crates/member/Cargo.toml": "[package]\nversion.workspace = true",
      }
    )
    await fs.writeFile(path.join(root, "Cargo.toml"), '[workspace.package]\nversion = "3.0.1"')
    await waitFor(() => hasVersion("3.0.1"))
    expect(await hasVersion("3.0.1")).toBe(true)
  }, 10000)
})
