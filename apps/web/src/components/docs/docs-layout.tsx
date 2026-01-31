import { createMemo, Show } from "solid-js"
import { usePageContext } from "vike-solid/usePageContext"
import { CopyPageButton } from "@/components/docs/copy-page-button"
import { DocsFooter } from "@/components/docs/docs-footer"
import { DocsHeader } from "@/components/docs/docs-header"
import { DocsNav } from "@/components/docs/docs-nav"
import { Sidebar } from "@/components/docs/sidebar"
import { TableOfContents } from "@/components/docs/table-of-contents"
import { MdxContentStatic } from "@/lib/velite/mdx-content"
import { MdxContext } from "@/lib/velite/mdx-context"
import { stripBasePath } from "@/utils/base-path"
import { useParams } from "@/route-tree.gen"
import { docs } from "@velite"
import { useMetadata } from "vike-metadata-solid"

interface DocsLayoutProps {
  children?: never
}

export function DocsLayout(_props: DocsLayoutProps) {
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
    // Extract headings from raw markdown
    if (!d?.rawMarkdown) return false
    return d.rawMarkdown.match(/^#{1,6}\s+/m) !== null
  })

  // Extract headings for TOC
  const headings = createMemo(() => {
    const d = doc()
    if (!d?.rawMarkdown) return []

    const headingsList: Array<{ level: number; text: string; slug: string }> = []
    const lines = d.rawMarkdown.split("\n")

    for (const line of lines) {
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
  })

  return (
    <div class="relative flex min-h-screen flex-col">
      <DocsHeader />

      <div class="container flex-1">
        <div class="flex-1 items-start md:grid md:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[288px_minmax(0,1fr)]">
          <Sidebar>
            <DocsNav />
          </Sidebar>

          <main class="relative px-4 py-6 md:px-6 lg:gap-10 lg:py-8 xl:grid xl:grid-cols-[1fr_220px] xl:px-8">
            <div class="mx-auto w-full min-w-0 max-w-3xl">
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
                  <article class="prose prose-slate dark:prose-invert max-w-none">
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
          </main>
        </div>
      </div>
    </div>
  )
}
