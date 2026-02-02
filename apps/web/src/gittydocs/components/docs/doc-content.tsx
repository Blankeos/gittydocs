import { createMemo, Show } from "solid-js"
import { usePageContext } from "vike-solid/usePageContext"
import { CopyPageButton } from "@/gittydocs/components/docs/copy-page-button"
import { DocsFooter } from "@/gittydocs/components/docs/docs-footer"
import { TableOfContents } from "@/gittydocs/components/docs/table-of-contents"
import { MdxContentStatic } from "@/gittydocs/lib/velite/mdx-content"
import { MdxContext } from "@/gittydocs/lib/velite/mdx-context"
import { stripBasePath } from "@/utils/base-path"
import { useParams } from "@/route-tree.gen"
import { docs } from "@velite"
import { useMetadata } from "vike-metadata-solid"

export function DocContent() {
  useMetadata({})

  const params = useParams({ from: "/@" })
  const slug = createMemo(() => params()["_@"] ?? "/")

  // Use velite's docs directly with slugAsParams
  // Handle root path (slugAsParams is "" for index.mdx)
  const doc = createMemo(() =>
    docs.find((d) => {
      const docSlug = d.slugAsParams === "" ? "/" : `/${d.slugAsParams}`
      return docSlug === slug()
    })
  )

  const pageContext = usePageContext()
  const routePath = createMemo(() => {
    const url = pageContext.urlParsed
    const pathname = url.pathname || "/"
    return stripBasePath(pathname)
  })

  const hasHeadings = createMemo(() => {
    const d = doc()
    if (!d?.rawMarkdown) return false
    return extractHeadingsFromMarkdown(d.rawMarkdown).length > 0
  })

  // Extract headings for TOC
  const headings = createMemo(() => {
    const d = doc()
    if (!d?.rawMarkdown) return []
    return extractHeadingsFromMarkdown(d.rawMarkdown)
  })

  return (
    <>
      <div class="mx-auto flex min-h-full w-full min-w-0 max-w-3xl flex-col">
        <Show
          when={doc()}
          fallback={
            <div class="py-12 text-center">
              <h1 class="font-bold text-2xl">Page not found</h1>
              <p class="mt-2 text-muted-foreground">
                The page you're looking for doesn't exist.
              </p>
              <p class="mt-1 text-muted-foreground text-sm">Path: {routePath()}</p>
            </div>
          }
        >
          {(d) => (
            <article class="prose prose-slate dark:prose-invert flex min-h-full max-w-none flex-col">
              <div class="flex-1">
                <Show when={d().title}>
                  <div class="mb-0 flex items-center justify-between">
                    <h1 class="scroll-m-20 font-bold text-3xl tracking-tight">{d().title}</h1>
                    <CopyPageButton markdown={d().rawMarkdown ?? ""} />
                  </div>
                </Show>

                <Show when={d().description}>
                  <p class="text-muted-foreground text-sm">{d().description}</p>
                </Show>

                <div class="mt-8">
                  <Show when={d().slug} keyed>
                    <MdxContext>
                      <MdxContentStatic code={d().content} />
                    </MdxContext>
                  </Show>
                </div>
              </div>

              <DocsFooter sourcePath={d().slugAsParams} />
            </article>
          )}
        </Show>
      </div>

      <Show when={hasHeadings()}>
        <div class="hidden text-sm xl:block">
          <div class="sticky top-16 -mt-10 h-[calc(100vh-3.5rem)] overflow-y-auto pt-10">
            <TableOfContents headings={headings()} />
          </div>
        </div>
      </Show>
    </>
  )
}

function extractHeadingsFromMarkdown(content: string) {
  const headingsList: Array<{ level: number; text: string; slug: string }> = []
  const lines = content.split("\n")
  let inFence = false
  let fenceChar: string | null = null
  let fenceLength = 0

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(```+|~~~+)/)
    if (fenceMatch) {
      const marker = fenceMatch[1]
      if (!inFence) {
        inFence = true
        fenceChar = marker[0]
        fenceLength = marker.length
        continue
      }

      if (fenceChar && marker[0] === fenceChar && marker.length >= fenceLength) {
        inFence = false
        fenceChar = null
        fenceLength = 0
        continue
      }
    }

    if (inFence) continue

    const match = line.match(/^(#{1,6})\s+(.+)$/)
    if (!match) continue
    const level = match[1].length
    const text = match[2].trim()
    const slug = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim()
    headingsList.push({ level, text, slug })
  }

  return headingsList
}
