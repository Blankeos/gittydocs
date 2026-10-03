import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { createServer, type ViteDevServer } from "vite"
import solid from "vite-plugin-solid"

// This exercises the actual DocContent -> hook -> both ToCs in a hydratable
// Solid DOM. The pure coordinator tests cannot catch SSR/client route mismatches.
// Run with an installed agent-browser; it launches its own isolated browser,
// never connecting to a developer's Chrome/CDP session.
const browser = Bun.which("agent-browser")
const runtimeRoot = path.resolve(import.meta.dir, "../../..")
const session = `toc-hook-test-${process.pid}`
let server: ViteDevServer
let directory: string
let url: string

async function command(...args: string[]) {
  const process = Bun.spawn([browser!, "--session", session, "--json", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ])
  if (exitCode !== 0) throw new Error(`agent-browser ${args[0]}: ${stderr || stdout}`)
  const response = JSON.parse(stdout)
  if (!response.success) throw new Error(response.error)
  return response.data
}

async function evaluate(code: string) {
  return (await command("eval", code)).result
}

const docs = [
  {
    slug: "configuration",
    slugAsParams: "configuration",
    title: "Configuration",
    content: "configuration",
    headings: [
      { slug: "options", text: "Options", level: 2 },
      { slug: "middle", text: "Middle", level: 2 },
      { slug: "fully-customize", text: "Fully Customize", level: 2 },
    ],
  },
  {
    slug: "other",
    slugAsParams: "other",
    title: "Other",
    content: "other",
    headings: [{ slug: "other-heading", text: "Other heading", level: 2 }],
  },
  { slug: "empty", slugAsParams: "empty", title: "Empty", content: "empty", headings: [] },
  {
    slug: "hidden",
    slugAsParams: "hidden",
    title: "Hidden",
    content: "hidden",
    sidebar: false,
    toc: false,
    headings: [{ slug: "hidden-heading", text: "Hidden heading", level: 2 }],
  },
]

const fixture = `
import { onMount, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { PageContextProvider } from "vike-solid/usePageContext"
import { DocContent } from ${JSON.stringify(path.join(runtimeRoot, "src/gittydocs/components/docs/doc-content.tsx"))}
import { usePageLayout } from ${JSON.stringify(path.join(runtimeRoot, "src/gittydocs/hooks/use-page-layout.ts"))}
import { findMdxDoc, normalizeRoutePath, resolvePage } from ${JSON.stringify(path.join(runtimeRoot, "src/gittydocs/lib/docs/page-layout.ts"))}

// Like the header/layout, this consumer must not depend on DocContent's resolution.
function LayoutConsumer() {
  const { routePath, page, sidebar, toc } = usePageLayout()
  onMount(() => {
    window.fixtureLayout = () => ({ routePath: routePath(), kind: page().kind,
      title: page().title, sidebar: sidebar(), toc: toc() })
  })
  return <aside data-layout-route={routePath()}>
    <Show when={sidebar()}><span data-sidebar-control>Sidebar</span></Show>
    <Show when={toc()}><span data-toc-control>ToC</span></Show>
  </aside>
}

export function Fixture(props) {
  // Like a static directory server: canonical SSR path, trailing slash in browser.
  const [pageContext, setPageContext] = createStore({ urlParsed: {
    pathname: typeof window === "undefined" ? props.pathname : window.location.pathname,
    hashOriginal: typeof window === "undefined" ? undefined : window.location.hash,
  } })
  onMount(() => {
    window.fixtureResolve = pathname => {
      const page = resolvePage(pathname)
      return { routePath: normalizeRoutePath(pathname), kind: page.kind,
        sidebar: page.sidebar, toc: page.toc, mdxSlug: findMdxDoc(pathname)?.slugAsParams ?? null }
    }
    window.fixtureNavigate = (pathname, hash = "") => {
      history.pushState(history.state, "", pathname + hash)
      window.scrollTo({ top: 0, behavior: "instant" })
      setPageContext("urlParsed", { pathname, hashOriginal: hash })
    }
  })
  return <PageContextProvider pageContext={pageContext}><LayoutConsumer /><DocContent /></PageContextProvider>
}
`

// Keep non-ToC presentation dependencies out of this focused test. Page resolution,
// headings, Solid hydration, DocContent, TableOfContents and coordinator are real.
const stubs: Record<string, string> = {
  "@velite": `export const docs = ${JSON.stringify(docs)}`,
  "vike-metadata-solid": "export const useMetadata = () => {}",
  "@/gittydocs/lib/docs/custom-pages": `
    const custom = { Component: () => null, sidebar: false, toc: false }
    export const getCustomPage = route => route === "/custom" ? custom : undefined
  `,
  "@/gittydocs/lib/docs/source-map.gen": "export const sourcePathByRoute = {}",
  "@/gittydocs/components/docs/copy-page-button": "export const CopyPageButton = () => null",
  "@/gittydocs/components/docs/docs-footer": "export const DocsFooter = () => null",
  "@/gittydocs/components/docs/nav-breadcrumbs": "export const NavBreadcrumbs = () => null",
  "@/gittydocs/components/docs/page-navigation": "export const PageNavigation = () => null",
  "@/gittydocs/lib/velite/mdx-context": "export const MdxContext = props => props.children",
  "@/gittydocs/lib/velite/mdx-content": `
    import { For } from "solid-js"
    import { docs } from "@velite"
    export const MdxContentStatic = props => <div><For each={docs.find(d => d.content === props.code)?.headings}>
      {h => <section style="min-height: 750px"><h2 id={h.slug}>{h.text}</h2></section>}
    </For></div>
  `,
}

describe.skipIf(!browser)("hydrated ToC hook lifecycle", () => {
  beforeAll(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "gittydocs-toc-hook-"))
    await symlink(path.join(runtimeRoot, "node_modules"), path.join(directory, "node_modules"))
    const stubPaths = new Map<string, string>()
    for (const [id, source] of Object.entries(stubs)) {
      const file = path.join(directory, `stub-${stubPaths.size}.tsx`)
      stubPaths.set(id, file)
      await writeFile(file, source)
    }
    await writeFile(path.join(directory, "fixture.tsx"), fixture)
    await writeFile(
      path.join(directory, "client.tsx"),
      'import { hydrate } from "solid-js/web"; import { Fixture } from "./fixture"; hydrate(() => <Fixture />, document.getElementById("app"));'
    )
    await writeFile(
      path.join(directory, "server.tsx"),
      'import { renderToString, generateHydrationScript } from "solid-js/web"; import { Fixture } from "./fixture"; export const render = pathname => generateHydrationScript() + \'<div id="app">\' + renderToString(() => <Fixture pathname={pathname} />) + \'</div>\';'
    )
    const htmlByRoute: Record<string, string> = {}
    server = await createServer({
      configFile: false,
      root: runtimeRoot,
      cacheDir: path.join(directory, "cache"),
      plugins: [
        {
          name: "toc-fixture-dependencies",
          enforce: "pre",
          configureServer(server) {
            server.middlewares.use((request, response, next) => {
              const pathname = request.url?.split("?")[0] ?? ""
              if (htmlByRoute[pathname]) {
                response.setHeader("Content-Type", "text/html")
                response.end(htmlByRoute[pathname])
              } else next()
            })
          },
          resolveId(id) {
            const relative = path.relative(path.join(runtimeRoot, "src"), id)
            if (!relative.startsWith("..")) {
              const alias = `@/${relative.replace(/\.tsx?$/, "")}`
              if (stubPaths.has(alias)) return stubPaths.get(alias)
            }
            return stubPaths.get(id)
          },
        },
        solid({ ssr: true, hot: false }),
      ],
      resolve: { alias: { "@": path.join(runtimeRoot, "src") } },
      server: { host: "127.0.0.1", port: 0, fs: { allow: [runtimeRoot, directory] } },
      optimizeDeps: {
        noDiscovery: true,
        include: [
          "solid-js",
          "solid-js/web",
          "solid-js/store",
          "mdast-util-from-markdown > micromark > debug",
        ],
      },
    })
    const { render } = await server.ssrLoadModule(path.join(directory, "server.tsx"))
    const componentCss = await Bun.file(
      path.join(runtimeRoot, "src/gittydocs/styles/mdx-components.css")
    ).text()
    // Include the real stylesheet and nested list shape to catch specificity
    // regressions: source-text tests alone missed the root list reset winning.
    const fileTree = `<article class="prose"><div class="mdx-files"><ul class="mdx-files-list">
      <li class="mdx-folder"><details open><summary class="mdx-folder-trigger"><span class="mdx-file-name" id="tree-root">docs</span></summary>
        <ul class="mdx-files-list mdx-folder-children"><li class="mdx-folder"><details open><summary class="mdx-folder-trigger"><span class="mdx-file-name" id="tree-folder">static</span></summary>
          <ul class="mdx-files-list mdx-folder-children"><li class="mdx-file"><span class="mdx-file-name" id="tree-child">logo.svg</span></li></ul>
        </details></li><li class="mdx-file"><span class="mdx-file-name" id="tree-sibling">gittydocs.jsonc</span></li></ul>
      </details></li></ul></div></article>`
    for (const route of ["/configuration", "/hidden"]) {
      htmlByRoute[`${route}/`] =
        `<!doctype html><html><head><style>${componentCss}</style></head><body>${render(route)}${fileTree}<script type="module" src="/@fs/${path.join(directory, "client.tsx")}"></script></body></html>`
    }
    await server.listen()
    const address = server.httpServer!.address()
    if (!address || typeof address === "string") throw new Error("Missing fixture server port")
    url = `http://127.0.0.1:${address.port}/configuration/?qa=2`
    await command("open", url)
    await command("set", "viewport", "1440", "900")
  }, 30000)

  afterAll(async () => {
    if (browser) await command("close")
    await server?.close()
    if (directory) await rm(directory, { recursive: true, force: true })
  })

  test("static trailing-slash hydration attaches both ToCs and immediately pins a click", async () => {
    expect(await evaluate("window.fixtureLayout()")).toEqual({
      routePath: "/configuration",
      kind: "mdx",
      title: "Configuration",
      sidebar: true,
      toc: true,
    })
    const state = await evaluate(`(() => {
      const link = document.querySelector('main a[href="#fully-customize"]')
      const event = new MouseEvent("click", { bubbles: true, cancelable: true })
      link.dispatchEvent(event)
      return { prevented: event.defaultPrevented, hash: location.hash,
        active: [...document.querySelectorAll('a[aria-current][href^="#"]')].map(a => a.textContent),
        mobile: document.querySelector('button[aria-controls]').textContent }
    })()`)
    expect(state.prevented).toBe(true)
    expect(state.hash).toBe("#fully-customize")
    expect(state.active).toEqual(["Fully Customize", "Fully Customize"])
    expect(state.mobile).toContain("Fully Customize")
  })

  test("nested Files spacing survives the root list reset at every level", async () => {
    const positions = await evaluate(`(() => {
      const x = id => document.getElementById(id).getBoundingClientRect().x
      return { root: x("tree-root"), folder: x("tree-folder"),
        child: x("tree-child"), sibling: x("tree-sibling") }
    })()`)
    expect(positions.folder - positions.root).toBe(24)
    expect(positions.child - positions.folder).toBe(24)
    expect(positions.sibling).toBe(positions.folder)
  })

  test("mobile selection closes the panel, shares state, and manual intent resumes the spy", async () => {
    const state = await evaluate(`(async () => {
      const button = document.querySelector('button[aria-controls]')
      button.click()
      const panel = document.getElementById(button.getAttribute("aria-controls"))
      panel.querySelector('a[href="#middle"]').click()
      const selected = [...document.querySelectorAll('a[aria-current][href^="#"]')].map(a => a.textContent)
      // End the navigation pin only on real user scroll intent, not an elapsed timer.
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: -100 }))
      window.scrollTo({ top: 0, behavior: "instant" })
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      return { selected, open: button.getAttribute("aria-expanded"),
        active: [...document.querySelectorAll('a[aria-current][href^="#"]')].map(a => a.textContent) }
    })()`)
    expect(state.selected).toEqual(["Middle", "Middle"])
    expect(state.open).toBe("false")
    expect(state.active).toEqual(["Options", "Options"])
  })

  test("initial hashes, hash/popstate navigation and route changes keep the hook alive", async () => {
    await command("open", `${url}#fully-customize`)
    expect(
      await evaluate(
        `[...document.querySelectorAll('a[aria-current][href^="#"]')].map(a => a.textContent)`
      )
    ).toEqual(["Fully Customize", "Fully Customize"])
    const state = await evaluate(`(async () => {
      history.pushState(history.state, "", "#middle")
      window.dispatchEvent(new PopStateEvent("popstate"))
      const back = [...document.querySelectorAll('a[aria-current][href^="#"]')].map(a => a.textContent)
      location.hash = "#options"
      await new Promise(resolve => window.addEventListener("hashchange", resolve, { once: true }))
      const hash = [...document.querySelectorAll('a[aria-current][href^="#"]')].map(a => a.textContent)
      window.fixtureNavigate("/other/", "#other-heading")
      const other = [...document.querySelectorAll('a[aria-current][href^="#"]')].map(a => a.textContent)
      window.fixtureNavigate("/empty/")
      const empty = document.querySelectorAll('a[aria-current][href^="#"]').length
      window.fixtureNavigate("/configuration/")
      const link = document.querySelector('main a[href="#fully-customize"]')
      const event = new MouseEvent("click", { bubbles: true, cancelable: true })
      link.dispatchEvent(event)
      return { back, hash, other, empty, prevented: event.defaultPrevented,
        active: [...document.querySelectorAll('a[aria-current][href^="#"]')].map(a => a.textContent) }
    })()`)
    expect(state.back).toEqual(["Middle", "Middle"])
    expect(state.hash).toEqual(["Options", "Options"])
    expect(state.other).toEqual(["Other heading", "Other heading"])
    expect(state.empty).toBe(0)
    expect(state.prevented).toBe(true)
    expect(state.active).toEqual(["Fully Customize", "Fully Customize"])
    expect((await command("errors")).errors).toEqual([])
  })

  test("false metadata survives trailing-slash hydration for every layout consumer", async () => {
    await command("open", new URL("/hidden/", url).href)
    const readState = `(() => ({
      ...window.fixtureLayout(),
      renderedRoute: document.querySelector('[data-layout-route]').getAttribute('data-layout-route'),
      sidebarControls: document.querySelectorAll('[data-sidebar-control]').length,
      tocControls: document.querySelectorAll('[data-toc-control]').length,
      tocLinks: document.querySelectorAll('a[href="#hidden-heading"]').length,
      heading: !!document.getElementById('hidden-heading'),
      title: document.querySelector('h1')?.textContent,
    }))()`
    const hidden = {
      routePath: "/hidden",
      renderedRoute: "/hidden",
      kind: "mdx",
      title: "Hidden",
      sidebar: false,
      toc: false,
      sidebarControls: 0,
      tocControls: 0,
      tocLinks: 0,
      heading: true,
    }
    expect(await evaluate(readState)).toEqual(hidden)
    await evaluate('window.fixtureNavigate("/configuration/")')
    expect(await evaluate("window.fixtureLayout()")).toEqual({
      routePath: "/configuration",
      kind: "mdx",
      title: "Configuration",
      sidebar: true,
      toc: true,
    })
    await evaluate('window.fixtureNavigate("/hidden///")')
    expect(await evaluate(readState)).toEqual(hidden)
    expect((await command("errors")).errors).toEqual([])
  })

  test("page resolution canonicalizes root, missing, MDX and custom routes centrally", async () => {
    for (const pathname of ["", "/", "///"]) {
      expect(await evaluate(`window.fixtureResolve(${JSON.stringify(pathname)})`)).toEqual({
        routePath: "/",
        kind: "missing",
        sidebar: true,
        toc: true,
        mdxSlug: null,
      })
    }
    for (const pathname of ["hidden", "/hidden", "/hidden/", "hidden///"]) {
      expect(await evaluate(`window.fixtureResolve(${JSON.stringify(pathname)})`)).toEqual({
        routePath: "/hidden",
        kind: "mdx",
        sidebar: false,
        toc: false,
        mdxSlug: "hidden",
      })
    }
    expect(await evaluate('window.fixtureResolve("/custom///")')).toEqual({
      routePath: "/custom",
      kind: "custom",
      sidebar: false,
      toc: false,
      mdxSlug: null,
    })
    expect(await evaluate('window.fixtureResolve("/missing///")')).toEqual({
      routePath: "/missing",
      kind: "missing",
      sidebar: true,
      toc: true,
      mdxSlug: null,
    })
  })
})
