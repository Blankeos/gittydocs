import type { FlowProps } from "solid-js"

import "@/styles/app.css"
import "@/styles/bprogress.css"
import "@/styles/prose.css"

import { useMetadata } from "vike-metadata-solid"
import { DocsProvider } from "@/components/docs/docs-provider"
import { ThemeContextProvider, themeInitScript } from "@/contexts/theme.context"

useMetadata.setGlobalDefaults({
  title: "gittydocs",
  description: "Turn a GitHub folder of Markdown/MDX into a fast, searchable docs site",
  viewport: {
    width: "device-width",
    initialScale: 1,
  },
  otherJSX: () => (
    <>
      <script innerHTML={themeInitScript} />
    </>
  )
})

export default function RootLayout(props: FlowProps) {
  return (
    <ThemeContextProvider>
      <DocsProvider>
        {props.children}
      </DocsProvider>
    </ThemeContextProvider>
  )
}
