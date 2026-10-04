import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { compile } from "@mdx-js/mdx"
import { browserExecutable, renderBrowserHarness } from "./render-browser-test-helper"

const harness = renderBrowserHarness("tabs-ssr")
const { evaluate } = harness
// Exercise CSS string escaping AND raw-text </style> injection, not just ordinary labels.
const specialValue = `quotes"' brackets] slash\\ newline\n</style><script>window.tabsInjected=true</script> é😀`
const source = `<Tabs items={["first", "second", "third"]} defaultIndex={1} label="Nonzero default">
<Tab value="first"><p>First panel</p></Tab>
<Tab value="second"><p>Second panel</p></Tab>
<Tab value="third"><p>Third panel</p></Tab>
</Tabs>
<Tabs items={["shared", "outer"]} defaultIndex={1} label="Outer">
<Tab value="shared"><p>Hidden outer panel</p></Tab>
<Tab value="outer">
<p>Visible outer panel</p>
<Tabs items={["shared", "inner"]} label="Inner">
<Tab value="shared"><p>Visible inner panel</p></Tab>
<Tab value="inner"><p>Hidden inner panel</p></Tab>
</Tabs>
</Tab>
</Tabs>
<Tabs items={["plain", ${JSON.stringify(specialValue)}]} defaultIndex={1} label="Special value">
<Tab value="plain"><p>Plain panel</p></Tab>
<Tab value={${JSON.stringify(specialValue)}}><p>Special panel</p></Tab>
</Tabs>
<p id="outside-tabs">Outside tabs remains visible</p>`

// Use real compiled MDX: its eager children are the reason a context-only SSR fix fails.
describe.skipIf(!browserExecutable)("MDX tabs before hydration", () => {
  beforeAll(async () => {
    const compiled = String(await compile(source, { outputFormat: "function-body" }))
    await harness.start(
      `import { MdxContentStatic } from "@/gittydocs/lib/velite/mdx-content"
      import { MdxContext } from "@/gittydocs/lib/velite/mdx-context"
      export function Fixture() {
        return <main class="prose" style="max-width: 700px; padding: 24px">
          <MdxContext><MdxContentStatic code={${JSON.stringify(compiled)}} /></MdxContext>
        </main>
      }`,
      // Heading toast is unrelated to tabs; its package evaluates client-only templates at import.
      { "solid-sonner": "export const toast = { success() {} }" },
      { ssr: true }
    )
  }, 60000)
  afterAll(() => harness.close())

  const panelState = (label: string) =>
    evaluate(`(() => {
      const root = [...document.querySelectorAll('.mdx-tabs')].find(root =>
        root.querySelector(':scope > [role=tablist]').getAttribute('aria-label') === ${JSON.stringify(label)})
      return [...root.querySelectorAll(':scope > .mdx-tab-panel')].map(panel => ({
        value: panel.dataset.tabValue,
        display: getComputedStyle(panel).display,
        visible: panel.getClientRects().length > 0,
      }))
    })()`)

  test("the fixture is server rendered and never mounts or hydrates", async () => {
    expect(
      await evaluate(`({
        scripts: document.scripts.length,
        mounted: window.fixtureReady === true,
        ready: document.querySelectorAll('.mdx-tabs[data-tabs-ready]').length,
        panels: document.querySelectorAll('.mdx-tab-panel').length,
        stylesheetCount: document.querySelectorAll('link[rel=stylesheet]').length,
      })`)
    ).toEqual({ scripts: 0, mounted: false, ready: 0, panels: 9, stylesheetCount: 3 })
  })

  test("only the nonzero defaultIndex panel is visible before any client JS", async () => {
    expect(await panelState("Nonzero default")).toEqual([
      { value: "first", display: "none", visible: false },
      { value: "second", display: "block", visible: true },
      { value: "third", display: "none", visible: false },
    ])
  })

  test("nested groups apply independent defaults to their direct panels", async () => {
    expect(await panelState("Outer")).toEqual([
      { value: "shared", display: "none", visible: false },
      { value: "outer", display: "block", visible: true },
    ])
    expect(await panelState("Inner")).toEqual([
      { value: "shared", display: "block", visible: true },
      { value: "inner", display: "none", visible: false },
    ])
    expect(
      await evaluate(`(() => {
        const ids = [...document.querySelectorAll('.mdx-tabs')].map(root => root.dataset.mdxTabs)
        return ids.every(Boolean) && new Set(ids).size === ids.length
      })()`)
    ).toBe(true)
  })

  test("special values match safely without breaking selectors or injecting HTML", async () => {
    expect(await panelState("Special value")).toEqual([
      { value: "plain", display: "none", visible: false },
      { value: specialValue, display: "block", visible: true },
    ])
    expect(
      await evaluate(`({
        injected: window.tabsInjected === true,
        scripts: document.scripts.length,
        outsideVisible: document.getElementById('outside-tabs').getClientRects().length > 0,
      })`)
    ).toEqual({ injected: false, scripts: 0, outsideVisible: true })
  })
})
