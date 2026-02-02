import type { FlowProps } from "solid-js"
import { DocsLayout } from "@/gittydocs/components/docs/docs-layout"

export default function DocsPageLayout(props: FlowProps) {
  return (
    <DocsLayout>
      {props.children}
    </DocsLayout>
  )
}
