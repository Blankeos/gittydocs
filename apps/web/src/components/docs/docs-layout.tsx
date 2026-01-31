import { createEffect, createMemo, Show } from "solid-js"
import { usePageContext } from "vike-solid/usePageContext"
import { CopyPageButton } from "@/components/docs/copy-page-button"
import { DocsFooter } from "@/components/docs/docs-footer"
import { DocsHeader } from "@/components/docs/docs-header"
import { DocsNav } from "@/components/docs/docs-nav"
import { Sidebar } from "@/components/docs/sidebar"
import { TableOfContents } from "@/components/docs/table-of-contents"
import { loadPage, useDocs } from "@/lib/gittydocs"
import { MdxContentStatic } from "@/lib/velite/mdx-content"
import { MdxContext } from "@/lib/velite/mdx-context"
import { stripBasePath } from "@/utils/base-path"

interface DocsLayoutProps {
  children?: never
}

export function DocsLayout(_props: DocsLayoutProps) {
  const docs = useDocs()
  const pageContext = usePageContext()

  // Get current route path from URL and convert to docs page path
  const routePath = createMemo(() => {
    const url = pageContext.urlParsed
    const pathname = url.pathname || "/"
    return stripBasePath(pathname)
  })

  createEffect(() => {
    loadPage(docs, routePath())
  })

  const page = createMemo(() => docs.currentPage)

  const hasHeadings = createMemo(() => {
    const p = page()
    return p && p.headings.length > 0
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
                when={!docs.isLoading}
                fallback={
                  <div class="flex items-center justify-center py-12">
                    <div class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                }
              >
                <Show when={docs.error}>
                  <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
                    <h3 class="font-semibold">Error loading documentation</h3>
                    <p class="text-sm">{docs.error}</p>
                  </div>
                </Show>
                <Show
                  when={page()}
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
                  {(p) => (
                    <article class="prose prose-slate dark:prose-invert max-w-none">
                      <Show when={p().title}>
                        <div class="mb-5 flex items-center justify-between">
                          <h1 class="scroll-m-20 font-bold text-4xl tracking-tight">{p().title}</h1>
                          <CopyPageButton markdown={p().rawContent} />
                        </div>
                      </Show>

                      <Show when={p().description}>
                        <p class="text-muted-foreground text-xl">{p().description}</p>
                      </Show>

                      <div class="mt-8">
                        <MdxContext>
                          <MdxContentStatic code={p().content} />
                        </MdxContext>
                      </div>

                      <DocsFooter />
                    </article>
                  )}
                </Show>
              </Show>
            </div>

            <Show when={hasHeadings()}>
              <div class="hidden text-sm xl:block">
                <div class="sticky top-16 -mt-10 h-[calc(100vh-3.5rem)] overflow-y-auto pt-10">
                  <TableOfContents headings={page()!.headings} />
                </div>
              </div>
            </Show>
          </main>
        </div>
      </div>
    </div>
  )
}
