import { afterEach, describe, expect, test } from "bun:test"
import fs from "node:fs"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import {
  autoTypeTableToMarkdown,
  remarkAutoTypeTable,
  resolveAutoTypeTable,
} from "./auto-type-table"

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})
function fixture(source = "export interface Options { label: string }") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "auto-type-table-"))
  roots.push(root)
  const docs = path.join(root, "docs")
  fs.mkdirSync(path.join(docs, "_components"), { recursive: true })
  fs.mkdirSync(path.join(docs, "pages"))
  fs.writeFileSync(path.join(docs, "_components/options.ts"), source)
  const mdxPath = path.join(docs, "pages/index.mdx")
  fs.writeFileSync(mdxPath, "")
  return {
    root,
    docs,
    mdxPath,
    input: { mdxPath, path: "../_components/options.ts", name: "Options", contentRoot: docs },
  }
}

describe("build-time AutoTypeTable", () => {
  test("formats readable Markdown without broken cells or executable HTML", () => {
    const markdown = autoTypeTableToMarkdown({
      value: { type: '"a" | "b"', description: "<script>\ntext", deprecated: true, required: true },
    })
    expect(markdown).toContain('"a" &#124; "b"')
    expect(markdown).toContain("Deprecated. &lt;script&gt;<br />text")
    expect(markdown).toContain("| Yes | — |")
  })

  test("supports standard libraries, TSX and concrete generic aliases", async () => {
    const f = fixture(`interface Box<T> { value: T }
export type Options = Box<ReadonlyArray<string>> & {
/** Timeout in milliseconds.
 * @defaultValue 100
 */
timeout?: number
}`)
    fs.renameSync(
      path.join(f.docs, "_components/options.ts"),
      path.join(f.docs, "_components/options.tsx")
    )
    const table = await resolveAutoTypeTable({ ...f.input, path: "../_components/options.tsx" })
    expect(table.value?.type).toBe("readonly string[]")
    expect(table.timeout?.default).toBe("100")
  })

  test("resolves inherited, optional, union, JSDoc and concrete alias properties", async () => {
    const f = fixture(`import type { Base } from './base'
export interface Options extends Base {
/** Visual treatment.
 * @default "quiet"
 */
variant?: 'quiet' | 'strong'
/** Legacy caption.
 * @deprecated Use label.
 */
caption?: string
}
export type Alias = Options & { count: number }`)
    fs.writeFileSync(
      path.join(f.docs, "_components/base.ts"),
      "export interface Base {\n/** Reader label. */\nlabel: string }"
    )
    const table = await resolveAutoTypeTable({ ...f.input, name: "Alias" })
    expect(table.label).toEqual({ type: "string", description: "Reader label.", required: true })
    expect(table.variant).toEqual({
      type: '"quiet" | "strong" | undefined',
      description: "Visual treatment.",
      default: '"quiet"',
      required: false,
    })
    expect(table.caption?.deprecated).toBe(true)
    expect(table.count).toEqual({ type: "number", required: true })
  })

  test("compiles real MDX to TypeTable with a static expression", async () => {
    const f = fixture()
    const require = createRequire(import.meta.url)
    const veliteRequire = createRequire(require.resolve("velite"))
    const { compile } = await import(veliteRequire.resolve("@mdx-js/mdx"))
    const compiled = await compile(
      {
        value: '<AutoTypeTable path="../_components/options.ts" name="Options" />',
        path: f.mdxPath,
      },
      {
        remarkPlugins: [[remarkAutoTypeTable, { contentRoot: f.docs }]],
      }
    )
    expect(String(compiled)).toContain("TypeTable")
    expect(String(compiled)).toContain("label")
    expect(String(compiled)).not.toContain("AutoTypeTable")
    expect(String(compiled)).not.toContain("typescript")
  })

  test.each([
    ["missing file", { path: "../_components/missing.ts" }, /not found/],
    ["missing type", { name: "Absent" }, /not found/],
    ["escape", { path: "../../outside.ts" }, /inside/],
    ["absolute", { path: "/tmp/outside.ts" }, /relative/],
    ["non-TS", { path: "../_components/options.js" }, /\.ts/],
  ])("reports %s", async (_label, change, message) => {
    const f = fixture()
    await expect(resolveAutoTypeTable({ ...f.input, ...change })).rejects.toThrow(message)
  })

  test.each([
    ["export type Options = string", /object/],
    ["export type Options = {a:string} | {b:number}", /union/],
    ["export interface Options<T> {a:T}", /Generic/],
    ["import {Missing} from './missing'; export interface Options {a:Missing}", /TS2307/],
    ["export interface Options {a:DoesNotExist}", /TS2304/],
    ["export interface Options {a:}", /diagnostics/],
  ])("rejects unsupported or invalid source: %s", async (source, message) => {
    const f = fixture(source)
    await expect(resolveAutoTypeTable(f.input)).rejects.toThrow(message)
  })

  test("blocks symlink and import escapes", async () => {
    const f = fixture(
      "import type { Secret } from '../../secret'; export interface Options {a:Secret}"
    )
    fs.writeFileSync(path.join(f.root, "secret.ts"), "export type Secret = string")
    await expect(resolveAutoTypeTable(f.input)).rejects.toThrow("TS2307")
    fs.symlinkSync(path.join(f.root, "secret.ts"), path.join(f.docs, "_components/link.ts"))
    await expect(
      resolveAutoTypeTable({ ...f.input, path: "../_components/link.ts" })
    ).rejects.toThrow("symlinks")
  })

  test("rejects package imports even when a package exists inside docs", async () => {
    const f = fixture(
      "import type { Value } from 'local-package'; export interface Options { value: Value }"
    )
    const packageRoot = path.join(f.docs, "node_modules/local-package")
    fs.mkdirSync(packageRoot, { recursive: true })
    fs.writeFileSync(path.join(packageRoot, "index.d.ts"), "export type Value = string")
    await expect(resolveAutoTypeTable(f.input)).rejects.toThrow("TS2307")
  })

  test("rejects expressions, spreads, extra props, duplicates and children with author context", async () => {
    const f = fixture()
    const props = [
      { type: "mdxJsxAttribute", name: "path", value: f.input.path },
      { type: "mdxJsxAttribute", name: "name", value: "Options" },
    ]
    for (const attributes of [
      [],
      [...props, props[0]],
      [...props, { type: "mdxJsxExpressionAttribute" }],
      [...props, { type: "mdxJsxAttribute", name: "extra", value: "x" }],
      [{ ...props[0], value: { value: "source" } }, props[1]],
    ]) {
      await expect(
        remarkAutoTypeTable({ contentRoot: f.docs })(
          {
            type: "root",
            children: [{ type: "mdxJsxFlowElement", name: "AutoTypeTable", attributes }],
          },
          { path: f.mdxPath }
        )
      ).rejects.toThrow(`[AutoTypeTable] ${f.mdxPath}`)
    }
    await expect(
      remarkAutoTypeTable({ contentRoot: f.docs })(
        {
          type: "mdxJsxFlowElement",
          name: "AutoTypeTable",
          attributes: props,
          children: [{ type: "text" }],
        },
        { path: f.mdxPath }
      )
    ).rejects.toThrow("children")
  })

  test("does not cache stale types across rebuilds", async () => {
    const f = fixture()
    expect((await resolveAutoTypeTable(f.input)).label?.type).toBe("string")
    fs.writeFileSync(
      path.join(f.docs, "_components/options.ts"),
      "export interface Options { label: number }"
    )
    expect((await resolveAutoTypeTable(f.input)).label?.type).toBe("number")
  })
})
