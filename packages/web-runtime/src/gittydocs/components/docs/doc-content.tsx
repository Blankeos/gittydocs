import { docs } from "@velite"
import { createEffect, createMemo, on, Show } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import { CopyPageButton } from "@/gittydocs/components/docs/copy-page-button"
import { DocsFooter } from "@/gittydocs/components/docs/docs-footer"
import { TableOfContents } from "@/gittydocs/components/docs/table-of-contents"
import { MdxContentStatic } from "@/gittydocs/lib/velite/mdx-content"
import { MdxContext } from "@/gittydocs/lib/velite/mdx-context"
import { useParams } from "@/route-tree.gen"
import { stripBasePath } from "@/utils/base-path"
import { extractHeadingsFromMarkdown } from "@/gittydocs/lib/heading-utils"
import getTitle from "@/utils/get-title"

export function DocContent() {
  const params = useParams({ from: "/@" })
  const slug = createMemo(() => params()["_@"] ?? "/")

  // Use velite's docs directly with slugAsParams
  // Handle root path (slugAsParams is "" for index.mdx)
  const currentDoc = createMemo(() =>
    docs.find((d) => {
      const docSlug = d.slugAsParams === "" ? "/" : `/${d.slugAsParams}`
      return docSlug === slug()
    })
  )

  // Set page metadata based on the current doc
  useMetadata(() => ({
    title: currentDoc()?.title ? getTitle(currentDoc()!.title) : undefined,
    description: currentDoc()?.description,
  }))

  const pageContext = usePageContext()
  const routePath = createMemo(() => {
    const url = pageContext.urlParsed
    const pathname = url.pathname || "/"
    return stripBasePath(pathname)
  })

  const hasHeadings = createMemo(() => {
    const d = currentDoc()
    if (!d?.rawMarkdown) return false
    return extractHeadingsFromMarkdown(d.rawMarkdown).length > 0
  })

  // Extract headings for TOC
  const headings = createMemo(() => {
    const d = currentDoc()
    if (!d?.rawMarkdown) return []
    return extractHeadingsFromMarkdown(d.rawMarkdown)
  })

  return (
    <>
      <Show
        when={currentDoc()}
        fallback={
          <div class="w-full max-w-6xl">
            <main class="relative flex flex-1 flex-col px-4 py-6 md:px-6 lg:gap-10 lg:py-8 xl:grid xl:grid-cols-[1fr_220px] xl:px-8">
              <div class="mx-auto flex min-h-full w-full min-w-0 max-w-3xl flex-col overflow-x-hidden">
                <div>
                  <h1 class="font-bold text-2xl">Page not found</h1>
                  <p class="mt-2 text-muted-foreground">
                    The page you're looking for doesn't exist.
                  </p>
                  <p class="mt-1 text-muted-foreground text-sm">Path: {routePath()}</p>
                </div>
              </div>
            </main>
          </div>
        }
      >
        {(d) => (
          <>
            <Show when={hasHeadings()}>
              <div class="sticky top-14 z-20 w-full xl:hidden">
                <TableOfContents headings={headings()} variant="mobile" />
              </div>
            </Show>
            <div class="w-full min-w-0 max-w-6xl">
              <main class="relative flex min-w-0 flex-1 flex-col px-4 py-6 md:px-6 lg:gap-10 lg:py-8 xl:grid xl:grid-cols-[minmax(0,1fr)_220px] xl:px-8">
                <div class="mx-auto flex min-h-full w-full min-w-0 max-w-3xl flex-col overflow-x-hidden">
                  <article class="prose prose-slate dark:prose-invert flex min-h-full min-w-0 max-w-none flex-col">
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

                    <DocsFooter sourcePath={d().sourcePath || d().slugAsParams} />
                  </article>
                </div>

                <Show when={hasHeadings()}>
                  <div class="hidden text-sm xl:block">
                    <div class="sticky top-16 -mt-10 h-[calc(100vh-3.5rem)] overflow-y-auto pt-10">
                      <TableOfContents headings={headings()} variant="desktop" />
                    </div>
                  </div>
                </Show>
              </main>
            </div>
          </>
        )}
      </Show>
    </>
  )
}
