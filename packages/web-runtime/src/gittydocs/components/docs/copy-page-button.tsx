import { useClipboard } from "bagon-hooks"
import { createMemo } from "solid-js"
import {
  IconAnthropic,
  IconCheck,
  IconChevronDown,
  IconCopy,
  IconGitHub,
  IconMarkdownLine,
  IconOpenAI,
} from "@/assets/icons"
import { Button } from "@/components/ui/button"
import { DropdownMenuComp } from "@/components/ui/dropdown-menu"
import { useDocsContext } from "@/gittydocs/contexts/docs.context"
import { useRoutePath } from "@/gittydocs/hooks/use-page-layout"
import { gittydocsSource } from "@/gittydocs/lib/docs/source.gen"
import { sourcePathByRoute } from "@/gittydocs/lib/docs/source-map.gen"
import { toReadableMarkdown } from "@/gittydocs/lib/markdown-export"
import {
  buildMarkdownUrl,
  buildSourceUrl,
  resolveSourceRepository,
} from "@/gittydocs/lib/source-url"

export interface CopyPageButtonProps {
  markdown: string
  /** Original docs-relative .md/.mdx filename, not Velite's "docs/" collection path. */
  sourcePath?: string
  routePath?: string
}

function openNewTab(url: string | null) {
  if (url && typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer")
}

export function CopyPageButton(props: CopyPageButtonProps) {
  const { copied, copy } = useClipboard()
  const docs = useDocsContext()
  const currentRoutePath = useRoutePath()
  const markdown = createMemo(() => toReadableMarkdown(props.markdown))
  const sourcePath = createMemo(() => {
    const routePath = props.routePath ?? currentRoutePath()
    return (
      props.sourcePath ??
      sourcePathByRoute[routePath] ??
      docs.pages.find((page) => page.routePath === routePath)?.sourcePath.replace(/^docs\//, "")
    )
  })
  const githubUrl = createMemo(() =>
    buildSourceUrl(resolveSourceRepository(docs.config?.site?.repo, gittydocsSource), sourcePath())
  )
  const markdownUrl = createMemo(() =>
    buildMarkdownUrl({
      sourcePath: sourcePath(),
      llms: docs.config?.llms,
      basePath: import.meta.env.BASE_URL,
    })
  )

  return (
    <div class="flex rounded-lg bg-black/10 p-[1.5px]">
      <Button
        variant="secondary"
        size="sm"
        class="h-[28px] w-[110px] shrink-0 justify-start gap-2 rounded-r-none"
        onClick={() => copy(markdown())}
      >
        {copied() ? <IconCheck class="size-4 shrink-0" /> : <IconCopy class="size-4 shrink-0" />}
        <span class="w-[70px] text-left">{copied() ? "Copied!" : "Copy page"}</span>
      </Button>
      <DropdownMenuComp
        triggerProps={{ "aria-label": "Page actions" }}
        options={[
          {
            type: "item",
            itemDisplay: (
              <span class="flex items-center gap-1">
                <IconMarkdownLine class="size-5 w-6 shrink-0" /> Copy page as Markdown for LLMs
              </span>
            ),
            itemOnSelect: () => copy(markdown()),
          },
          {
            type: "item",
            hide: !githubUrl(),
            itemDisplay: (
              <span class="flex items-center gap-1">
                <IconGitHub class="size-5 w-6 shrink-0" /> Open in GitHub
              </span>
            ),
            itemOnSelect: () => openNewTab(githubUrl()),
          },
          {
            type: "item",
            hide: !markdownUrl(),
            itemDisplay: (
              <span class="flex items-center gap-1">
                <IconMarkdownLine class="size-5 w-6 shrink-0" /> View as Markdown
              </span>
            ),
            itemOnSelect: () => openNewTab(markdownUrl()),
          },
          {
            type: "item",
            itemDisplay: (
              <span class="flex items-center gap-1">
                <IconOpenAI class="shrink-0" /> Open in ChatGPT
              </span>
            ),
            itemOnSelect: () =>
              openNewTab(
                `https://chatgpt.com/?hints=search&prompt=Read+from+${encodeURIComponent(window.location.href)}+so+I+can+ask+questions+about+it.`
              ),
          },
          {
            type: "item",
            itemDisplay: (
              <span class="flex items-center gap-1">
                <IconAnthropic class="shrink-0" /> Open in Claude
              </span>
            ),
            itemOnSelect: () =>
              openNewTab(
                `https://claude.ai/new?q=Read%20from%20${encodeURIComponent(window.location.href)}%20so%20I%20can%20ask%20questions%20about%20it.`
              ),
          },
        ]}
      >
        <Button
          as="div"
          size="icon"
          variant="secondary"
          class="size-[28px] shrink-0 rounded-l-none"
        >
          <IconChevronDown class="size-4 shrink-0" />
        </Button>
      </DropdownMenuComp>
    </div>
  )
}
