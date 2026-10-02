import { useClipboard } from "bagon-hooks"
import { type JSX, Show } from "solid-js"
import { IconCheck, IconCopy } from "@/assets/icons"
import { FileIcon } from "./icons"

export type CodeBlockProps = JSX.IntrinsicElements["pre"] & { "data-code-title"?: string }

export function CodeBlock(props: CodeBlockProps) {
  const { copied, copy } = useClipboard()
  let preRef: HTMLPreElement | undefined
  const title = () => props["data-code-title"]

  const handleCopy = () => {
    // The filename/header is deliberately outside the pre: only code is copied.
    const code = preRef?.querySelector("code")?.textContent ?? preRef?.textContent ?? ""
    if (!code.trim()) return
    copy(code.replace(/\n+$/, ""))
  }

  const CopyButton = () => (
    <button
      type="button"
      class="code-block-copy backdrop-blur-[1px]"
      data-copied={copied() ? "true" : "false"}
      onClick={handleCopy}
      aria-label={copied() ? "Copied" : "Copy code"}
      title={copied() ? "Copied" : "Copy code"}
    >
      {copied() ? (
        <IconCheck class="size-4 animate-scaleIn" />
      ) : (
        <IconCopy class="size-4 animate-scaleIn" />
      )}
    </button>
  )

  return (
    <div class="code-block" data-titled={title() ? "true" : undefined}>
      <Show when={title()} fallback={<CopyButton />}>
        {(filename) => (
          <div class="mdx-code-header">
            <span class="mdx-code-title" title={filename()}>
              <FileIcon name={filename()} />
              <span class="mdx-code-filename">{filename()}</span>
            </span>
            <CopyButton />
          </div>
        )}
      </Show>
      <pre
        {...props}
        ref={(element) => {
          preRef = element
        }}
      />
    </div>
  )
}
