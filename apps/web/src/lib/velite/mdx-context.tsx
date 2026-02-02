import { useClipboard } from "bagon-hooks"
import type { FlowProps, JSX } from "solid-js"
import { MDXProvider } from "solid-jsx"
import { toast } from "solid-sonner"

import { IconCheck, IconCopy } from "@/assets/icons"

type HeadingProps = JSX.IntrinsicElements["h1"] & { level?: number }

function HeadingLink(props: HeadingProps) {
  const id = props.id

  const handleClick = () => {
    if (!id) return
    history.replaceState(null, "", `#${id}`)
    const el = document.getElementById(id)
    el?.scrollIntoView({ behavior: "smooth", block: "start" })
    navigator.clipboard.writeText(`${location.origin}${location.pathname}#${id}`)
    toast.success("Copied section link to clipboard")
  }

  const sharedProps = {
    onClick: handleClick,
    get class() { return `${props.class ?? ""} group relative cursor-pointer hover:opacity-80` },
    style: { "scroll-margin-top": "4rem" } as JSX.CSSProperties,
  }

  const content = (
    <>
      <span
        class="pointer-events-none absolute -left-4 top-1/2 -translate-y-1/2 text-sm font-normal opacity-0 transition-opacity duration-150 group-hover:opacity-60"
        aria-hidden="true"
      >
        #
      </span>
      {props.children}
    </>
  )

  if ((props.level ?? 1) === 6) return <h6 {...props} {...sharedProps}>{content}</h6>
  if ((props.level ?? 1) === 5) return <h5 {...props} {...sharedProps}>{content}</h5>
  if ((props.level ?? 1) === 4) return <h4 {...props} {...sharedProps}>{content}</h4>
  if ((props.level ?? 1) === 3) return <h3 {...props} {...sharedProps}>{content}</h3>
  if ((props.level ?? 1) === 2) return <h2 {...props} {...sharedProps}>{content}</h2>
  return <h1 {...props} {...sharedProps}>{content}</h1>
}

export const mdxComponents: Record<string, (properties: never) => JSX.Element> = {
  h1: (props: any) => <HeadingLink level={1} {...props} />,
  h2: (props: any) => <HeadingLink level={2} {...props} />,
  h3: (props: any) => <HeadingLink level={3} {...props} />,
  h4: (props: any) => <HeadingLink level={4} {...props} />,
  h5: (props: any) => <HeadingLink level={5} {...props} />,
  h6: (props: any) => <HeadingLink level={6} {...props} />,
  pre: (props: any) => <CodeBlock {...props} />,
}

export function MdxContext(props: FlowProps) {
  return <MDXProvider components={mdxComponents}>{props.children}</MDXProvider>
}

function CodeBlock(props: JSX.IntrinsicElements["pre"]) {
  const { copied, copy } = useClipboard()
  let preRef: HTMLPreElement | undefined

  const handleCopy = () => {
    const code = preRef?.querySelector("code")?.textContent ?? preRef?.textContent ?? ""
    if (!code.trim()) return
    copy(code.replace(/\n+$/, ""))
    toast.success("Copied section url to clipboard")
  }

  return (
    <div class="code-block">
      <button
        type="button"
        class="code-block-copy"
        data-copied={copied() ? "true" : "false"}
        onClick={handleCopy}
        aria-label={copied() ? "Copied" : "Copy code"}
        title={copied() ? "Copied" : "Copy code"}
      >
        {copied() ? <IconCheck class="size-4 animate-scaleIn" /> : <IconCopy class="size-4 animate-scaleIn" />}
      </button>
      <pre
        ref={(element) => {
          preRef = element
        }}
        {...props}
      />
    </div>
  )
}
