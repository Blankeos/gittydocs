import { useClipboard } from "bagon-hooks"
import {
  IconAnthropic,
  IconCheck,
  IconChevronDown,
  IconCopy,
  IconGemini,
  IconMarkdownLine,
  IconOpenAI,
} from "@/assets/icons"
import { Button } from "../ui/button"
import { DropdownMenuComp } from "../ui/dropdown-menu"

export function CopyPageButton(props: { markdown: string }) {
  const { copied, copy } = useClipboard()
  return (
    <div class="flex rounded-lg bg-black/10 p-[1.5px]">
      <Button
        variant="secondary"
        size="sm"
        class="h-[28px] w-[110px] shrink-0 justify-start gap-2 rounded-r-none"
        onClick={() => copy(props.markdown)}
      >
        {copied() ? <IconCheck class="size-4 shrink-0" /> : <IconCopy class="size-4 shrink-0" />}
        <span class="w-[70px] text-left">{copied() ? "Copied!" : "Copy page"}</span>
      </Button>
      <DropdownMenuComp
        options={[
          {
            type: "item",
            itemDisplay: (
              <span class="flex items-center gap-1">
                <IconMarkdownLine class="size-5 w-6 shrink-0" /> Copy page as Markdown for LLMs
              </span>
            ),
            // itemTip: <IconFileTextSpark />,
            itemOnSelect: () => {
              copy(props.markdown || "")
            },
          },
          {
            type: "item",
            itemDisplay: (
              <span class="flex items-center gap-1">
                <IconOpenAI class="shrink-0" /> Open in ChatGPT
              </span>
            ),
            // itemTip: <IconArrowUpRight />,
            itemOnSelect: () => {
              window.open(
                `https://chatgpt.com/?hints=search&prompt=Read+from+${encodeURIComponent(window.location.href)}+so+I+can+ask+questions+about+it.`,
                "_blank"
              )
            },
          },
          {
            type: "item",
            itemDisplay: (
              <span class="flex items-center gap-1">
                <IconAnthropic class="shrink-0" /> Open in Claude
              </span>
            ),
            // itemTip: <IconArrowUpRight />,
            itemOnSelect: () => {
              window.open(
                `https://claude.ai/new?q=Read%20from%20${encodeURIComponent(window.location.href)}%20so%20I%20can%20ask%20questions%20about%20it.`,
                "_blank"
              )
            },
          },
          // This isn't possible unfortunately
          // {
          //   type: "item",
          //   itemDisplay: (
          //     <span class="flex items-center gap-1">
          //       <IconGemini class="shrink-0" /> Open in Gemini
          //     </span>
          //   ),
          //   // itemTip: <IconArrowUpRight />,
          //   itemOnSelect: () => {
          //     const prompt = `Read from ${window.location.href} so I can ask questions about it.`;
          //       window.open(
          //         `https://www.google.com/search?q=${encodeURIComponent(prompt)}`,
          //         "_blank"
          //       );            },
          // },
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
