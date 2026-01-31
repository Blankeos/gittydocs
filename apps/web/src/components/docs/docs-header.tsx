import { createEffect, createSignal, onCleanup, Show } from "solid-js"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { IconMoonDuo, IconSunDuo } from "@/assets/icons"
import { useThemeContext } from "@/contexts/theme.context"
import { useDocsContext } from "@/contexts/docs.context"
import { withBasePath } from "@/utils/base-path"
import { DocsNav } from "./docs-nav"
import { SearchDialog } from "./search-dialog"
import { useSearchContext } from "@/contexts/search.context"

export function DocsHeader() {
  const {} = useSearchContext()
  const docs = useDocsContext()
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
  const repoUrl = () => {
    const repo = docs.config?.site?.repo
    if (repo) {
      return `https://github.com/${repo.owner}/${repo.repo}`
    }
    return null
  }

  return (
    <>
      <header class="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div class="mx-auto flex h-14 items-center px-4">
          <div class="mr-4 flex items-center gap-2">
            {/* Mobile Menu Button */}
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
                  <DrawerTitle class="text-left">{siteName()}</DrawerTitle>
                </DrawerHeader>
                <div class="flex-1 overflow-auto py-4">
                  <DocsNav />
                </div>
              </DrawerContent>
            </Drawer>

            <a href={withBasePath("/")} class="mr-6 flex items-center space-x-2">
              <span class="font-bold">{siteName()}</span>
            </a>
          </div>

          <div class="flex flex-1 items-center justify-end gap-4">
            <nav class="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                class="h-9 w-9"
              >
                <Show when={inferredTheme() === "dark"} fallback={<IconSunDuo class="h-5 w-5" />}>
                  <IconMoonDuo class="h-5 w-5" />
                </Show>
                <span class="sr-only">Toggle theme</span>
              </Button>
              <Show when={repoUrl()}>
                <a
                  href={repoUrl()!}
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

            <div class="w-full max-w-md flex-1 md:w-auto md:flex-none">
              <Button
                variant="outline"
                class="relative flex h-8 items-center justify-start rounded-[0.5rem] bg-background font-normal text-muted-foreground text-sm shadow-none hover:bg-accent hover:text-accent-foreground w-full"
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
                  class="mr-2 h-4 w-4"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                Search...
                <kbd class="pointer-events-none ml-auto h-5 select-none items-center justify-center gap-1 rounded border bg-muted px-1.5 font-medium font-mono text-[10px] opacity-100 flex">
                  <span class="text-xs">⌘</span><span>K</span>
                </kbd>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <SearchDialog open={searchOpen()} onOpenChange={setSearchOpen} />
    </>
  )
}
