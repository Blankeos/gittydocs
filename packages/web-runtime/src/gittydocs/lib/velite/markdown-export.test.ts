import { expect, test } from "bun:test"
import { resolveAutoTypeTablesInMarkdown } from "./markdown-export"

test("plain Markdown never parses literal JSX examples as MDX", async () => {
  const raw =
    '# Comparison\n\nUse x < y and {literal braces}.\n\n```mdx\n<AutoTypeTable path="./missing.ts" name="Options" />\n```'
  expect(await resolveAutoTypeTablesInMarkdown(raw, "/docs/guide.md", "/missing")).toBe(raw)
})
test("fenced auto table examples stay byte-for-byte in MDX", async () => {
  const raw = '```mdx\n<AutoTypeTable path="./missing.ts" name="Options" />\n```'
  expect(await resolveAutoTypeTablesInMarkdown(raw, "/docs/guide.mdx", "/missing")).toBe(raw)
})
