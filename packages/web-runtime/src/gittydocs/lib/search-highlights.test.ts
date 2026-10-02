import { describe, expect, test } from "bun:test"
import { createSearchSnippet, highlightSearchText } from "./search-highlights"

describe("safe search highlights", () => {
  test("treats metacharacters literally instead of executing a user regular expression", () => {
    for (const query of ["C++", "[", "a.b", "(a)", "*", "\\"]) {
      const text = `before ${query} after`
      const segments = highlightSearchText(text, query)
      expect(segments.map((segment) => segment.text).join("")).toBe(text)
      expect(segments.filter((segment) => segment.matched).map((segment) => segment.text)).toEqual([
        query,
      ])
    }
  })

  test("keeps unsafe user content as unchanged text, never interpolated mark HTML", () => {
    const text = '<img src=x onerror="alert(1)"> & <script>alert(2)</script>'
    const segments = highlightSearchText(text, "alert")
    expect(segments.map((segment) => segment.text).join("")).toBe(text)
    expect(segments.filter((segment) => segment.matched).map((segment) => segment.text)).toEqual([
      "alert",
      "alert",
    ])
    expect(segments.every((segment) => !segment.text.includes("<mark>"))).toBe(true)
  })

  test("highlights multiple terms preserving case and handles whitespace-only queries", () => {
    expect(highlightSearchText("Solid documentation DOCS", "solid docs")).toEqual([
      { text: "Solid", matched: true },
      { text: " documentation ", matched: false },
      { text: "DOCS", matched: true },
    ])
    expect(highlightSearchText("hello", "  ")).toEqual([{ text: "hello", matched: false }])
  })

  test("creates bounded excerpts near the match with truncation indicators", () => {
    const text = `${"prefix ".repeat(70)}needle ${"suffix ".repeat(70)}`
    const snippet = createSearchSnippet(text, "needle")
    expect(snippet).toContain("needle")
    expect(snippet.startsWith("…")).toBe(true)
    expect(snippet.endsWith("…")).toBe(true)
    expect(snippet.length).toBeLessThanOrEqual(162)
  })
})
