import type { FlowProps } from "solid-js"

import "@/styles/app.css"
import "@/styles/bprogress.css"
import "@/gittydocs/styles/prose.css"

import { Toaster } from "solid-sonner"
import { useMetadata } from "vike-metadata-solid"
import { ThemeContextProvider, themeInitScript, useThemeContext } from "@/contexts/theme.context"
import { DocsProvider } from "@/gittydocs/components/docs/docs-provider"
import { gittydocsConfig } from "@/gittydocs/lib/docs/config.gen"
import { themeCssHref } from "@/gittydocs/lib/themes/theme-source.gen"
import { withBasePath } from "@/utils/base-path"

const faviconHref = resolveAssetHref(gittydocsConfig?.site?.favicon)

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
      <script src="https://tweakcn.com/live-preview.min.js"></script>
      {faviconHref ? <link rel="icon" href={faviconHref} /> : null}
      {themeCssHref ? <link rel="stylesheet" href={withBasePath(themeCssHref)} /> : null}
    </>
  ),
})

export default function RootLayout(props: FlowProps) {
  return (
    <ThemeContextProvider>
      <DocsProvider>
        {props.children}
        <_Toaster />
      </DocsProvider>
    </ThemeContextProvider>
  )
}

function _Toaster() {
  const { inferredTheme } = useThemeContext()
  return <Toaster theme={inferredTheme()} richColors />
}

function resolveAssetHref(asset?: string) {
  if (!asset) return null
  if (/^(https?:)?\/\//i.test(asset) || asset.startsWith("data:")) return asset
  return withBasePath(asset)
}
