import { describe, expect, test } from "bun:test"
import { toReadableMarkdown } from "../../src/gittydocs/lib/markdown-export"

describe("toReadableMarkdown", () => {
  test("numbers titled steps, retaining Markdown and untitled content", () => {
    const result = toReadableMarkdown(
      '<Steps>\n<Step title="Install">\nRun **bun install**.\n</Step>\n<Step>\nStart the server.\n</Step>\n</Steps>'
    )
    expect(result).toContain("### 1. Install\n\nRun **bun install**.")
    expect(result).toContain("### 2. Step\n\nStart the server.")
    expect(result).not.toMatch(/<\/?Steps?\b/)
  })
  test("renders nested folders and file descriptions as a readable list", () => {
    const result = toReadableMarkdown(
      '<Files>\n<Folder name="src" defaultOpen>\n<File name="index.ts" description="Entry point" />\n<Folder name="lib"><File name="utils.ts" /></Folder>\n</Folder>\n<File name="package.json"/>\n</Files>'
    )
    expect(result).toContain("- `src/`")
    expect(result).toContain("  - `index.ts` — Entry point")
    expect(result).toContain("  - `lib/`")
    expect(result).toContain("    - `utils.ts`")
    expect(result).toContain("- `package.json`")
    expect(result).not.toMatch(/<\/?(?:Files|Folder|File)\b/)
  })
  test("accordions retain every body, including nested components", () => {
    const result = toReadableMarkdown(
      '<Accordions type="single"><Accordion title="FAQ" defaultOpen={false}>Hidden body.\n<Accordion title="Nested">Answer.</Accordion>\n<Steps><Step title="Try it">Do this.</Step></Steps></Accordion></Accordions>'
    )
    expect(result).toContain("### FAQ\n\nHidden body.")
    expect(result).toContain("#### Nested\n\nAnswer.")
    expect(result).toContain("#### 1. Try it\n\nDo this.")
    expect(result).not.toMatch(/<\/?Accordions?\b/)
  })
  test("supports literal JSX string expressions, multiline tags and entities", () => {
    const result = toReadableMarkdown(
      '<Accordion\n title={"Why > when < ?"}\n><Files><File name={\'config.ts\'} description="A &amp; B"/><File name={`readme.md`}/></Files></Accordion>'
    )
    expect(result).toContain("### Why \\> when \\< ?")
    expect(result).toContain("`config.ts` — A & B")
    expect(result).toContain("`readme.md`")
  })
  test("preserves fenced examples with built-in JSX byte-for-byte", () => {
    for (const fence of ["```", "~~~~", "````"]) {
      const code = `${fence}mdx\r\n<Steps>\r\n  <Step title="Literal">\r\n    <Files><File name="example.ts"/></Files>\r\n  </Step>\r\n</Steps>\r\n${fence}\r\n`
      expect(toReadableMarkdown(code)).toBe(code)
      const result = toReadableMarkdown(`<Steps><Step title="Real">\n${code}\n</Step></Steps>`)
      expect(result).toContain(code)
      expect(result).toContain("### 1. Real")
    }
  })
  test("does not parse inline code as JSX", () => {
    const raw = 'Use `<File name="foo" />` or ``<Step title="bar">`x`</Step>``.'
    expect(toReadableMarkdown(raw)).toBe(raw)
  })
  test("preserves fenced code in blockquote and list containers byte-for-byte", () => {
    for (const fence of ["```", "~~~~", "````"]) {
      for (const newline of ["\n", "\r\n"]) {
        const code = [
          `${fence}mdx title="Literal"`,
          '<Steps><Step title="Literal">',
          '  <Files><File name="example.ts"/></Files>',
          "</Step></Steps>",
          fence,
        ]
        const examples = [
          code.map((line) => `  ${line}`).join(newline) + newline,
          code.map((line) => `> ${line}`).join(newline) + newline,
          code.map((line) => `> > ${line}`).join(newline) + newline,
          code.map((line, index) => `${index ? "  " : "- "}${line}`).join(newline) + newline,
          code.map((line, index) => `${index ? "   " : "1. "}${line}`).join(newline) + newline,
          code.map((line, index) => `> ${index ? "  " : "- "}${line}`).join(newline) + newline,
        ]
        for (const example of examples) {
          expect(toReadableMarkdown(example)).toBe(example)
          const result = toReadableMarkdown(
            `<Steps>${newline}<Step title="Real">${newline}${example}${newline}</Step>${newline}</Steps>`
          )
          expect(result).toContain(example)
          expect(result).toContain("### 1. Real")
        }
      }
    }
  })
  test("preserves indented code, container indentation and inline source spans exactly", () => {
    for (const newline of ["\n", "\r\n"]) {
      for (const indent of ["    ", "\t", ">     ", "-     "]) {
        const example = `${indent}<Files><File name="literal.ts"/></Files>${newline}`
        expect(toReadableMarkdown(example)).toBe(example)
      }
      const example = `    <Steps>${newline}      <Step title="Literal"/>${newline}    </Steps>${newline}`
      expect(toReadableMarkdown(example)).toBe(example)
      const result = toReadableMarkdown(
        `<Steps>${newline}<Step title="Real">${newline}${example}${newline}</Step>${newline}</Steps>`
      )
      expect(result).toContain(example)
      expect(result).toContain("### 1. Real")
      const inline = `> Use \`\` <File name="literal.ts"/>${newline}> \`nested\` \`\` unchanged.${newline}`
      expect(toReadableMarkdown(inline)).toBe(inline)
      const listCode = `- Item${newline}${newline}      <File name="literal.ts"/>${newline}`
      expect(toReadableMarkdown(listCode)).toBe(listCode)
      const listResult = toReadableMarkdown(
        `<Steps>${newline}<Step title="Real">${newline}${listCode}${newline}</Step>${newline}</Steps>`
      )
      expect(listResult).toContain(listCode)
      expect(listResult).toContain("### 1. Real")
    }
  })
  test("protects unterminated container fences through their original end", () => {
    for (const fence of ["```", "~~~"]) {
      for (const prefix of ["> ", "- "]) {
        const continuation = prefix === "> " ? "> " : "  "
        const example = `${prefix}${fence}mdx\n${continuation}<File name="literal.ts"/>\n`
        expect(toReadableMarkdown(example)).toBe(example)
      }
    }
  })
  test("does not globally strip user JSX, imports, HTML, or frontmatter", () => {
    const raw =
      '---\ntitle: Demo\n---\nimport { Custom } from "./Custom"\n\n<Custom title="Keep"><span>Hello</span></Custom>\n\n<!-- comment -->\n'
    expect(toReadableMarkdown(raw)).toBe(raw)
    expect(
      toReadableMarkdown('<Custom><Accordion title="FAQ">Answer</Accordion></Custom>')
    ).toContain("<Custom>")
  })
  test("leaves unsupported dynamic labels, malformed components and unrelated names intact", () => {
    for (const raw of [
      "<Accordion title={computed}>Keep this.</Accordion>",
      "<File name={fileName} />",
      '<Folder name="x">unfinished',
      "<FileIcon />",
      '<Accordion title="x"',
      '<File name="x" description={computed}/>',
    ]) {
      expect(toReadableMarkdown(raw)).toBe(raw)
    }
  })
  test("resets nested step numbering, and escapes Markdown in labels", () => {
    const result = toReadableMarkdown(
      '<Steps><Step title="One"><Steps><Step title="Nested"/></Steps></Step><Step title="Two"/></Steps><Accordion title="[Not a link] *bold*">OK</Accordion>'
    )
    expect(result).toContain("### 1. One")
    expect(result).toContain("#### 1. Nested")
    expect(result).toContain("### 2. Two")
    expect(result).toContain("### \\[Not a link\\] \\*bold\\*")
  })
  test("ordinary Markdown and unterminated fenced examples are unchanged", () => {
    for (const raw of [
      "# Heading\n\n- One\n- Two\n",
      "```mdx\n<Steps><Step>Example</Step></Steps>\n",
      "",
    ])
      expect(toReadableMarkdown(raw)).toBe(raw)
  })
})
