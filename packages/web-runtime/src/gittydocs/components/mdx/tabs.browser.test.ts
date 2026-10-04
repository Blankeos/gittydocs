import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { compile } from "@mdx-js/mdx"
import { browserExecutable, renderBrowserHarness } from "./render-browser-test-helper"

const harness = renderBrowserHarness("tabs-type-table")
const { command, evaluate } = harness
const source = `<Tabs items={["npm", "pnpm", "yarn", "bun"]} groupId="pm" label="Install">
<Tab value="npm">npm install example</Tab>
<Tab value="pnpm">pnpm add example</Tab>
<Tab value="yarn">yarn add example</Tab>
<Tab value="bun">bun add example</Tab>
</Tabs>
<Tabs items={["npm", "pnpm", "yarn", "bun"]} groupId="pm" label="Update">
<Tab value="npm">npm update</Tab>
<Tab value="pnpm">pnpm update</Tab>
<Tab value="yarn">yarn upgrade</Tab>
<Tab value="bun">bun update</Tab>
</Tabs>
<Tabs items={["first", "second"]} defaultIndex={1} label="Separate">
<Tab value="first">First</Tab><Tab value="second">Second</Tab>
</Tabs>
<TypeTable caption="Options" type={{ label: { type: "string", required: true, description: "Reader label" }, old: { type: "boolean", deprecated: true, default: "false" } }} />`

describe.skipIf(!browserExecutable)("MDX tabs and type references", () => {
  beforeAll(async () => {
    const compiled = String(await compile(source, { outputFormat: "function-body" }))
    await harness.start(
      `
      import { MdxContentStatic } from "@/gittydocs/lib/velite/mdx-content"
      import { MdxContext } from "@/gittydocs/lib/velite/mdx-context"
      export function Fixture() { return <main style="max-width: 700px; padding: 24px" class="prose"><MdxContext><MdxContentStatic code={${JSON.stringify(compiled)}} /></MdxContext></main> }
    `,
      {}
    )
  }, 60000)
  afterAll(() => harness.close())
  const state = () =>
    evaluate(
      `([...document.querySelectorAll('.mdx-tabs')].map(root => ({selected: root.querySelector('[aria-selected=true]').textContent, visible: [...root.querySelectorAll('[role=tabpanel]')].filter(p => !p.hidden).map(p => p.textContent), tabbable: root.querySelectorAll('[role=tab][tabindex="0"]').length})))`
    )

  test("eager MDX children have correctly linked panels and defaults", async () => {
    expect(await state()).toEqual([
      { selected: "npm", visible: ["npm install example"], tabbable: 1 },
      { selected: "npm", visible: ["npm update"], tabbable: 1 },
      { selected: "second", visible: ["Second"], tabbable: 1 },
    ])
    expect(
      await evaluate(
        `([...document.querySelectorAll('[role=tab]')].every(t => document.getElementById(t.getAttribute('aria-controls'))?.getAttribute('aria-labelledby') === t.id))`
      )
    ).toBe(true)
  })
  test("Default appears only for rows with a documented default", async () => {
    expect(
      await evaluate(`([...document.querySelectorAll('.mdx-type-row')].map(row => ({
        name: row.querySelector('.mdx-type-name code').textContent,
        default: row.querySelector('.mdx-type-default')?.textContent ?? null,
        placeholder: row.querySelector('[title="No default"]') !== null
      })))`)
    ).toEqual([
      { name: "label", default: null, placeholder: false },
      { name: "old", default: "Defaultfalse", placeholder: false },
    ])
  })
  test("compact labels have no full-width divider", async () => {
    expect(
      await evaluate(`(() => {
      const list = document.querySelector('.mdx-tabs-list')
      const tab = list.querySelector('[aria-selected=true]')
      return { size: getComputedStyle(tab).fontSize, divider: getComputedStyle(list).borderBottomWidth,
        indicator: getComputedStyle(tab).borderBottomWidth }
    })()`)
    ).toEqual({ size: "12px", divider: "0px", indicator: "2px" })
  })
  test("selection syncs and persists without touching unrelated groups", async () => {
    await command("click", '.mdx-tabs:first-child button[data-tab-value="pnpm"]')
    expect((await state()).map((s: { selected: string }) => s.selected)).toEqual([
      "pnpm",
      "pnpm",
      "second",
    ])
    expect(await evaluate(`sessionStorage.getItem('gittydocs-tabs:pm')`)).toBe("pnpm")
  })
  test("arrow, Home and End keys move focus and activate one panel", async () => {
    await command("press", "ArrowRight")
    expect((await state())[0].selected).toBe("yarn")
    await command("press", "End")
    expect((await state())[0].selected).toBe("bun")
    await command("press", "ArrowRight")
    expect((await state())[0].selected).toBe("npm")
    await command("press", "Home")
    expect(await evaluate(`document.activeElement.textContent`)).toBe("npm")
  })
  test("reload restores the package choice", async () => {
    await command("click", '.mdx-tabs:first-child button[data-tab-value="bun"]')
    await command("reload")
    await command("wait", "[role=tabpanel]:not([hidden])")
    expect((await state())[0].selected).toBe("bun")
  })
  test("collapsed type rows blend into a compact bordered container", async () => {
    expect(
      await evaluate(
        `({caption:document.querySelector('.mdx-type-table-caption').textContent, rows:document.querySelectorAll('.mdx-type-row > summary').length, badges:[...document.querySelectorAll('.mdx-type-badge')].map(x=>x.textContent), border:getComputedStyle(document.querySelector('.mdx-type-table-frame')).borderTopWidth, background:getComputedStyle(document.querySelector('.mdx-type-row')).backgroundColor, gap:getComputedStyle(document.querySelectorAll('.mdx-type-row')[1]).marginTop})`
      )
    ).toEqual({
      caption: "Options",
      rows: 2,
      badges: ["Required", "Deprecated"],
      border: "1px",
      background: "rgba(0, 0, 0, 0)",
      gap: "2px",
    })
  })
  test("type rows animate both directions and work with keyboard controls", async () => {
    const bodyHeight = () =>
      evaluate(
        `(() => { const row = document.querySelector('.mdx-type-row'); return row.getBoundingClientRect().height - row.querySelector('summary').getBoundingClientRect().height - 2 })()`
      )
    await command("click", ".mdx-type-row:first-of-type > summary")
    expect(await evaluate(`document.querySelector('.mdx-type-row').open`)).toBe(true)
    expect(
      await evaluate(
        `(() => { const row=document.querySelector('.mdx-type-row'); return getComputedStyle(row).borderTopColor === getComputedStyle(document.querySelector('.mdx-type-table-frame')).borderTopColor })()`
      )
    ).toBe(true)
    const animations = await evaluate(
      `document.querySelector('.mdx-type-row').getAnimations({subtree:true}).map(a => a.effect.getTiming().duration)`
    )
    expect(animations.some((duration: number) => duration > 0)).toBe(true)
    await evaluate(`new Promise(resolve => setTimeout(resolve, 300))`)
    const expanded = await bodyHeight()
    expect(expanded).toBeGreaterThan(40)
    expect(await evaluate(`document.querySelector('.mdx-type-description').textContent`)).toBe(
      "Reader label"
    )
    await command("press", "Enter")
    expect(await evaluate(`document.querySelector('.mdx-type-row').open`)).toBe(false)
    await evaluate(`new Promise(resolve => setTimeout(resolve, 300))`)
    expect(await bodyHeight()).toBe(0)
    expect(
      await evaluate(`getComputedStyle(document.querySelector('.mdx-type-row')).borderTopColor`)
    ).toBe("rgba(0, 0, 0, 0)")
    await command("press", "Space")
    expect(await evaluate(`document.querySelector('.mdx-type-row').open`)).toBe(true)
    await evaluate(`new Promise(resolve => setTimeout(resolve, 300))`)
  })
  test("mobile rows wrap without horizontal overflow", async () => {
    await command("set", "viewport", "360", "800")
    expect(await evaluate(`document.documentElement.scrollWidth <= innerWidth`)).toBe(true)
    expect(
      await evaluate(
        `(() => { const row=document.querySelector('.mdx-type-row');return row.querySelector('.mdx-type-value').getBoundingClientRect().top > row.querySelector('.mdx-type-name').getBoundingClientRect().top })()`
      )
    ).toBe(true)
    await command("screenshot", "/tmp/gittydocs-components-mobile.png")
    await command("set", "viewport", "1000", "900")
    await command("screenshot", "/tmp/gittydocs-components-desktop.png")
  })
  test("reduced motion removes type row animations without blocking toggles", async () => {
    await command("set", "media", "light", "reduced-motion")
    await command("click", ".mdx-type-row:first-of-type > summary")
    expect(
      await evaluate(`(() => {
      const row = document.querySelector('.mdx-type-row')
      return { reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, open: row.open,
        animations: row.getAnimations({subtree:true}).length,
        chevron: getComputedStyle(row.querySelector('svg')).transitionDuration }
    })()`)
    ).toEqual({ reduced: true, open: false, animations: 0, chevron: "0s" })
    await command("press", "Enter")
    expect(await evaluate(`document.querySelector('.mdx-type-row').open`)).toBe(true)
    await command("set", "media", "light", "no-preference")
  })
  test("Mono light/dark modes keep tabs and table text readable", async () => {
    for (const dark of [false, true]) {
      const colors = await evaluate(`(() => {
        document.documentElement.dataset.theme = 'mono'
        document.documentElement.classList.toggle('dark', ${dark})
        document.body.style.background = 'var(--background)'
        const tab = document.querySelector('.mdx-tab-trigger[aria-selected=true]')
        return { tab: getComputedStyle(tab).color, text: getComputedStyle(document.querySelector('.mdx-type-table')).color,
          foreground: getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim(),
          cellBorder: getComputedStyle(document.querySelector('.mdx-type-table-frame')).borderLeftWidth }
      })()`)
      expect(colors.tab).toBe(dark ? "rgb(237, 237, 237)" : "rgb(23, 23, 23)")
      expect(colors.cellBorder).toBe("1px")
      await command("screenshot", `/tmp/gittydocs-components-mono-${dark ? "dark" : "light"}.png`)
    }
  })
})
