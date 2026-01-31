import { runSync } from "@mdx-js/mdx"
import type { JSX } from "solid-js"
import * as runtime from "solid-jsx"

interface MdxProps {
  code: string
}

export function MdxContentStatic(props: MdxProps): JSX.Element {
  const mdxModule = runSync(props.code, { ...(runtime as any), baseUrl: import.meta.url })
  const Content = () => mdxModule.default || (() => null)
  return Content as unknown as JSX.Element
}
