import { createEffect, createSignal, onCleanup, Show } from "solid-js"
import { IconMoon, IconSun } from "@/assets/icons"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { useThemeContext } from "@/contexts/theme.context"
import { useDocsContext } from "@/gittydocs/contexts/docs.context"
import { useSearchContext } from "@/gittydocs/contexts/search.context"
import { usePageLayout } from "@/gittydocs/hooks/use-page-layout"
import { withBasePath } from "@/utils/base-path"
import { cn } from "@/utils/cn"
import { DocsNav } from "./docs-nav"
import { SearchDialog } from "./search-dialog"

export function DocsHeader() {
  const docs = useDocsContext()
  const { sidebar } = usePageLayout()
  const { inferredTheme, toggleTheme } = useThemeContext()
  const [searchOpen, setSearchOpen] = createSignal(false)
  const [mobileMenuOpen, setMobileMenuOpen] = createSignal(false)

  // Handle keyboard shortcut
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault()
      setSearchOpen(true)
    }
  }

  createEffect(() => {
    if (typeof window === "undefined") return
    window.addEventListener("keydown", handleKeyDown)
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown))
  })

  const siteName = () => docs.config?.site?.name ?? "gittydocs"
  const logoUrl = () => {
    const logo = docs.config?.site?.logo
    if (!logo) return null
    if (/^(https?:)?\/\//i.test(logo) || logo.startsWith("data:")) return logo
    return withBasePath(logo)
  }
  const repoUrl = () => {
    const repo = docs.config?.site?.repo
    if (repo) {
      return `https://github.com/${repo.owner}/${repo.name}`
    }
    return null
  }
  const githubUrl = () => docs.config?.links?.github ?? repoUrl()

  return (
    <>
      <header class="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div class="mx-auto flex h-14 items-center px-4">
          <div class="mr-4 flex items-center gap-2">
            {/* Mobile Menu Button */}
            <Show when={sidebar()}>
              <Drawer side="left" open={mobileMenuOpen()} onOpenChange={setMobileMenuOpen}>
                <DrawerTrigger as={Button} variant="ghost" size="icon" class="md:hidden">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="h-5 w-5"
                  >
                    <line x1="4" x2="20" y1="12" y2="12" />
                    <line x1="4" x2="20" y1="6" y2="6" />
                    <line x1="4" x2="20" y1="18" y2="18" />
                  </svg>
                  <span class="sr-only">Toggle menu</span>
                </DrawerTrigger>
                <DrawerContent class="w-[280px] p-0">
                  <DrawerHeader class="border-b px-4 py-3">
                    <DrawerTitle class="flex items-center gap-2 text-left">
                      <Show when={logoUrl()}>
                        {(src) => (
                          <img src={src()} alt={siteName()} class="h-6 w-6 object-contain" />
                        )}
                      </Show>
                      <span class="font-semibold">{siteName()}</span>
                    </DrawerTitle>
                  </DrawerHeader>
                  <div class="flex-1 overflow-auto py-4">
                    <DocsNav onNavigate={() => setMobileMenuOpen(false)} />
                  </div>
                </DrawerContent>
              </Drawer>
            </Show>

            <a href={withBasePath("/")} class="mr-6 flex items-center gap-2">
              <Show when={logoUrl()}>
                {(src) => <img src={src()} alt={siteName()} class="h-6 w-6 object-contain" />}
              </Show>
              <span class="font-bold">{siteName()}</span>
            </a>
          </div>

          <div class="ml-auto flex items-center justify-end gap-2 md:gap-3">
            <nav class="hidden items-center gap-1 md:flex">
              <Button variant="ghost" size="icon" onClick={toggleTheme} class="h-9 w-9">
                <Show when={inferredTheme() === "dark"} fallback={<IconSun class="h-5 w-5" />}>
                  <IconMoon class="h-5 w-5" />
                </Show>
                <span class="sr-only">Toggle theme</span>
              </Button>
              <Show when={githubUrl()}>
                <a
                  href={githubUrl()!}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex h-9 w-9 items-center justify-center rounded-md font-medium text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    class="h-5 w-5"
                  >
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  <span class="sr-only">GitHub</span>
                </a>
              </Show>
            </nav>

            <Button
              variant="outline"
              size="sm"
              class={cn(
                "h-9 w-9 shrink-0 px-0 font-normal text-sm shadow-none",
                "md:w-52 md:justify-start md:gap-2 md:px-3 lg:w-60"
              )}
              onClick={() => setSearchOpen(true)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <span class="hidden flex-1 truncate text-left text-muted-foreground md:block">
                Search...
              </span>
              <kbd class="pointer-events-none ml-auto hidden h-5 shrink-0 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-medium font-mono text-[10px] text-muted-foreground md:inline-flex">
                <span>⌘</span>
                <span>K</span>
              </kbd>
              <span class="sr-only md:hidden">Search</span>
            </Button>
          </div>
        </div>
      </header>

      <SearchDialog
        open={searchOpen()}
        onOpenChange={setSearchOpen}
        onToggleTheme={toggleTheme}
        themeLabel={inferredTheme() === "dark" ? "Switch to light" : "Switch to dark"}
        githubUrl={githubUrl()}
      />
    </>
  )
}
