// Source compiled by the isolated Vite harness, with all presentation modules real.
export const filesTreeFixture = `
import { PageContextProvider } from "vike-solid/usePageContext"
import { Files, Folder, File } from "@/gittydocs/components/mdx/files"
import { CodeBlock } from "@/gittydocs/components/mdx/code-block"
import { DocsNav } from "@/gittydocs/components/docs/docs-nav"

export function Fixture() {
  return <PageContextProvider pageContext={{ urlParsed: { pathname: "/guide" } }}>
    <main style="padding: 24px; width: 700px">
      <article class="prose">
        <Files>
          <Folder name="docs" defaultOpen>
            <Folder name="static" defaultOpen>
              <File name="logo.svg" description="Site logo" />
              <File name="index.tsx" />
            </Folder>
            <File name="gittydocs.jsonc" />
            <File name="README.md" />
          </Folder>
          <File name="root.txt" />
          <Folder name="closed"><File name="hidden.ts" /></Folder>
        </Files>
        <CodeBlock data-code-title="index.tsx"><code>export default 1</code></CodeBlock>
      </article>
      <aside style="width: 280px"><DocsNav /></aside>
    </main>
  </PageContextProvider>
}
`

export const filesTreeContextStub = `
import { createDocsNavigation } from "@/gittydocs/lib/nav-utils"
const pages = ["/guide", "/guide/child", "/other", "/other/child"].map(routePath => ({
  routePath, title: routePath, sourcePath: routePath.slice(1) + ".mdx",
  headings: [], content: "", rawContent: ""
}))
const nav = [
  { label: "Guide", path: "/guide", accordion: true, defaultOpen: true,
    items: [{ label: "Guide child", path: "/guide/child" }] },
  { label: "Other", path: "/other", accordion: true,
    items: [{ label: "Other child", path: "/other/child" }] }
]
const context = { pages, nav, navigation: createDocsNavigation(pages, nav, "/"),
  config: { llms: { enabled: false } } }
export const useDocsContext = () => context
`
