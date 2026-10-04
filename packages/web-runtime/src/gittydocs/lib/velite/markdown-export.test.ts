import { afterEach, expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { resolveAutoTypeTablesInMarkdown } from "./markdown-export"

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "auto-table-export-"))
  roots.push(root)
  writeFileSync(
    path.join(root, "types.ts"),
    "export interface First { label: string }\nexport interface Second { count?: number }"
  )
  return { root, mdxPath: path.join(root, "guide.mdx") }
}

test("plain Markdown never parses literal JSX examples as MDX", async () => {
  const raw =
    '# Comparison\n\nUse x < y and {literal braces}.\n\n```mdx\n<AutoTypeTable path="./missing.ts" name="Options" />\n```'
  expect(await resolveAutoTypeTablesInMarkdown(raw, "/docs/guide.md", "/missing")).toBe(raw)
})
test("fenced auto table examples stay byte-for-byte in MDX", async () => {
  const raw = '```mdx\n<AutoTypeTable path="./missing.ts" name="Options" />\n```'
  expect(await resolveAutoTypeTablesInMarkdown(raw, "/docs/guide.mdx", "/missing")).toBe(raw)
})

test("resolves nested and multiple tables without rewriting surrounding MDX or examples", async () => {
  const { root, mdxPath } = fixture()
  const first = '<AutoTypeTable path="./types.ts" name="First" />'
  const second = '<AutoTypeTable path="./types.ts" name="Second" />'
  const example = `\`\`\`mdx\n${first}\n\`\`\``
  const raw = `# API\n\n<Accordion title="Details">\n\n${first}\n\n</Accordion>\n\nBetween.\n\n${second}\n\n${example}\n\nEnd.`
  const result = await resolveAutoTypeTablesInMarkdown(raw, mdxPath, root)
  expect(result).toContain('<Accordion title="Details">')
  expect(result).toContain("| label | string | Yes |")
  expect(result).toContain("| count | number &#124; undefined | No |")
  expect(result.indexOf("| label |")).toBeLessThan(result.indexOf("Between."))
  expect(result.indexOf("Between.")).toBeLessThan(result.indexOf("| count |"))
  expect(result).toContain(example)
  expect(result).toEndWith("End.")
})

test("Markdown adapter reports the same author-context diagnostics as the MDX adapter", async () => {
  const { root, mdxPath } = fixture()
  await expect(
    resolveAutoTypeTablesInMarkdown('<AutoTypeTable path={source} name="First" />', mdxPath, root)
  ).rejects.toThrow(`[AutoTypeTable] ${mdxPath}: path must be a non-empty quoted string literal`)
  await expect(
    resolveAutoTypeTablesInMarkdown(
      '<AutoTypeTable path="./types.ts" name="Missing" />',
      mdxPath,
      root
    )
  ).rejects.toThrow("not found")
})
