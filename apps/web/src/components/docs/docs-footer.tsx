import { Show } from "solid-js"
import { useDocsContext } from "@/contexts/docs.context"

interface DocsFooterProps {
  sourcePath?: string
}

export function DocsFooter(props: DocsFooterProps) {
  const docs = useDocsContext()

  const editUrl = () => {
    if (!props.sourcePath) return null
    const repo = docs.config?.site?.repo
    if (!repo) return null
    const { owner, repo: repoName, ref } = repo
    const docsPath = repo.docsPath || "docs"
    return `https://github.com/${owner}/${repoName}/edit/${ref}/${docsPath}/${props.sourcePath}`
  }

  const issuesUrl = () => {
    if (docs.config?.links?.issues) return docs.config.links.issues
    const repo = docs.config?.site?.repo
    if (repo) {
      return `https://github.com/${repo.owner}/${repo.repo}/issues`
    }
    return null
  }

  const discordUrl = () => {
    return docs.config?.links?.discord || null
  }

  return (
    <footer class="mt-16 border-t pt-8">
      <div class="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div class="flex flex-col gap-3">
          <Show when={editUrl()}>
            {(url) => (
              <a
                href={url()}
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
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
                class="inline-flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
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
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                </svg>
                Find a bug? Open an issue
              </a>
            )}
          </Show>

          <Show when={discordUrl()}>
            {(url) => (
              <a
                href={url()}
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
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
                  <path d="M8 12a1 1 0 1 0 2 0 1 1 0 1 0-2 0" />
                  <path d="M14 12a1 1 0 1 0 2 0 1 1 0 1 0-2 0" />
                  <path d="M15.5 17c0 1 1.5 2 2.5 2s2.5-1 2.5-2c0-1.5-1.5-2.5-2.5-2.5S15.5 15.5 15.5 17z" />
                  <path d="M6.5 17c0 1 1.5 2 2.5 2s2.5-1 2.5-2c0-1.5-1.5-2.5-2.5-2.5S6.5 15.5 6.5 17z" />
                  <path d="M18.5 6.5c-1.5-1-3.5-1.5-5.5-1.5s-4 .5-5.5 1.5" />
                  <path d="M18.5 17.5v-11" />
                  <path d="M5.5 17.5v-11" />
                </svg>
                Join our Discord community
              </a>
            )}
          </Show>
        </div>

        <div class="flex flex-col items-end gap-1 text-right">
          <div class="text-muted-foreground text-sm">
            © {new Date().getFullYear()} {docs.config?.site?.name || "Documentation"}
          </div>
          <div class="text-muted-foreground text-xs">
            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      </div>
    </footer>
  )
}
