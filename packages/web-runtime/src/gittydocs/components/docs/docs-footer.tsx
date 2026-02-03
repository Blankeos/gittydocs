import { Show } from "solid-js"
import { useDocsContext } from "@/gittydocs/contexts/docs.context"

interface DocsFooterProps {
  sourcePath?: string
}

export function DocsFooter(props: DocsFooterProps) {
  const docs = useDocsContext()

  const editUrl = () => {
    if (!props.sourcePath) return null
    const repo = docs.config?.site?.repo
    if (!repo) return null
    const { owner, name } = repo
    const ref = repo.ref || "main"
    const docsPath = repo.docsPath || "docs"
    return `https://github.com/${owner}/${name}/edit/${ref}/${docsPath}/${props.sourcePath}`
  }

  const githubUrl = () => {
    if (docs.config?.links?.github) return docs.config.links.github
    const repo = docs.config?.site?.repo
    if (repo) {
      return `https://github.com/${repo.owner}/${repo.name}`
    }
    return null
  }

  const issuesUrl = () => {
    if (docs.config?.links?.issues) return docs.config.links.issues
    const repo = docs.config?.site?.repo
    if (repo) {
      return `https://github.com/${repo.owner}/${repo.name}/issues`
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
          <Show when={githubUrl()}>
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
                  fill="currentColor"
                  class="h-4 w-4"
                >
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                View on GitHub
              </a>
            )}
          </Show>
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
            {new Date().toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        </div>
      </div>
    </footer>
  )
}
