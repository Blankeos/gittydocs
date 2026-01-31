import { Show } from "solid-js"
import { getEditUrl, getIssuesUrl } from "@/lib/docs/source"
import { useDocs } from "@/lib/gittydocs"

export function DocsFooter() {
  const docs = useDocs()
  const currentPage = () => docs.currentPage

  const editUrl = () => {
    if (!currentPage()) return null
    return getEditUrl(currentPage()!.sourcePath)
  }

  const issuesUrl = () => getIssuesUrl(docs.config)

  return (
    <footer class="border-t py-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-4">
          <Show when={editUrl()}>
            {(url) => (
              <a
                href={url()}
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 text-muted-foreground text-sm transition-colors hover:text-foreground"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="h-4 w-4"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit this page
              </a>
            )}
          </Show>

          <Show when={issuesUrl()}>
            {(url) => (
              <a
                href={url()}
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 text-muted-foreground text-sm transition-colors hover:text-foreground"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="h-4 w-4"
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
                Open an issue
              </a>
            )}
          </Show>
        </div>

        <div class="text-muted-foreground text-sm">
          Powered by{" "}
          <a
            href="https://github.com/anomalyco/gittydocs"
            target="_blank"
            rel="noopener noreferrer"
            class="transition-colors hover:text-foreground"
          >
            gittydocs
          </a>
        </div>
      </div>
    </footer>
  )
}
