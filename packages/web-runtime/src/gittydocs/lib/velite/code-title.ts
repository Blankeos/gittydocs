import type { RehypeShikiOptions } from "@shikijs/rehype"

type ShikiTransformer = NonNullable<RehypeShikiOptions["transformers"]>[number]

/** Parse metadata tokens, not substrings inside another quoted attribute. */
export function parseCodeTitle(meta: unknown): string | undefined {
  if (typeof meta !== "string") return undefined
  const attributes =
    /(?:^|\s)([\w-]+)\s*=\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^\s"']+))(?=\s|$)/g
  for (const match of meta.matchAll(attributes)) {
    if (match[1] !== "title") continue
    const value = (match[2] ?? match[3] ?? match[4]).replace(/\\([\\"'])/g, "$1")
    return value.trim() ? value : undefined
  }
  return undefined
}

export function codeTitleTransformer(): ShikiTransformer {
  return {
    name: "gittydocs:code-title",
    pre(node) {
      // @shikijs/rehype v4 reads code.data.meta (the original Markdown fence
      // metadata) and exposes it to transformers as options.meta.__raw.
      const title = parseCodeTitle(this.options.meta?.__raw)
      if (title !== undefined) node.properties["data-code-title"] = title
    },
  }
}
