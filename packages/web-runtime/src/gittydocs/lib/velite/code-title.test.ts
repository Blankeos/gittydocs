import { describe, expect, test } from "bun:test"
import rehypeShiki from "@shikijs/rehype"
import { codeTitleTransformer, parseCodeTitle } from "./code-title"

describe("code title metadata", () => {
  test.each([
    ['title="config.js"', "config.js"],
    ["title='config.js'", "config.js"],
    ['title="my config file.js"', "my config file.js"],
    ["title='my config file.js'", "my config file.js"],
    ['{1,3} title = "src/config.js" showLineNumbers', "src/config.js"],
    ["title=config.js", "config.js"],
    ['title="say \\"hello\\".js"', 'say "hello".js'],
    ["title='it\\'s config.js'", "it's config.js"],
    ['title="C:\\src\\config.js"', "C:\\src\\config.js"],
    ['caption="example title=wrong.js" title="right.js"', "right.js"],
    ["caption='title=wrong.js'", undefined],
    ['subtitle="wrong.js"', undefined],
    ['data-title="wrong.js"', undefined],
    ['title=""', undefined],
    ["title='   '", undefined],
    ['title="unterminated', undefined],
    ['title="bad.js"trailing', undefined],
    ["showLineNumbers", undefined],
    ["", undefined],
  ])("parses %s", (meta, expected) => {
    expect(parseCodeTitle(meta)).toBe(expected)
  })

  test("ignores non-string metadata", () => {
    expect(parseCodeTitle(undefined)).toBeUndefined()
    expect(parseCodeTitle(null)).toBeUndefined()
    expect(parseCodeTitle({ title: "config.js" })).toBeUndefined()
  })
})

describe("Shiki v4 code-title transformer", () => {
  test.each([
    ["js", 'title="config.js"', "config.js"],
    ["js", "title='my config.js'", "my config.js"],
    ["unsupported-language", 'title="config.unknown"', "config.unknown"],
    [undefined, 'title="plain text.txt"', "plain text.txt"],
    ["js", undefined, undefined],
  ])("preserves raw metadata for %s", async (language, meta, expected) => {
    // This is the HAST shape produced by the Markdown compiler for either
    // backtick or tilde fences. Shiki replaces it entirely during highlighting.
    const tree = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "pre",
          properties: {},
          children: [
            {
              type: "element",
              tagName: "code",
              properties: { className: language ? [`language-${language}`] : [] },
              data: { meta },
              children: [{ type: "text", value: 'console.log("hello")\n' }],
            },
          ],
        },
      ],
    }
    const transform = Reflect.apply(rehypeShiki, {}, [
      {
        theme: "one-dark-pro",
        langs: ["javascript"],
        defaultLanguage: "text",
        fallbackLanguage: "text",
        transformers: [codeTitleTransformer()],
      },
    ])
    await transform(tree)
    const highlightedPre = tree.children[0] as any
    expect(highlightedPre.children[0].properties["data-code-title"]).toBe(expected)
    expect(JSON.stringify(highlightedPre)).toContain("hello")
  })
})
