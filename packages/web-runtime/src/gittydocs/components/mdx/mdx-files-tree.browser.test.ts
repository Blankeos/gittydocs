import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { filesTreeContextStub, filesTreeFixture } from "./mdx-files-tree.fixture"
import { browserExecutable, renderBrowserHarness } from "./render-browser-test-helper"

const harness = renderBrowserHarness("files-tree-render")
const { command, evaluate } = harness
const settle = () => evaluate(`new Promise(resolve => setTimeout(resolve, 300))`)

// Select by visible labels/roles; these are real Files/Folder/File and DocsNav DOM.
describe.skipIf(!browserExecutable)("rendered file tree and sidebar", () => {
  beforeAll(async () => {
    await harness.start(filesTreeFixture, {
      "@/gittydocs/contexts/docs.context": filesTreeContextStub,
    })
  }, 60000)
  afterAll(() => harness.close())

  test("nested names/icons align, indentation compounds and guides do not shift rows", async () => {
    const state = await evaluate(`(() => {
      const row = name => [...document.querySelectorAll('.mdx-file-name')]
        .find(el => el.textContent === name).parentElement
      const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } }
      const rows = Object.fromEntries(['docs', 'static', 'logo.svg', 'index.tsx', 'gittydocs.jsonc', 'README.md', 'root.txt']
        .map(name => [name, { name: rect(row(name).querySelector('.mdx-file-name')), icon: rect(row(name).querySelector('.mdx-file-icon')), row: rect(row(name)) }]))
      const guides = [...document.querySelectorAll('.mdx-folder-children')].filter(el => el.closest('details').open)
        .map(el => { const style = getComputedStyle(el, '::before'); return { width: style.width,
          position: style.position, color: style.backgroundColor, expected: getComputedStyle(document.querySelector('.mdx-files')).borderTopColor,
          border: getComputedStyle(el).borderLeftWidth } })
      return { rows, guides, header: rect(document.querySelector('.mdx-code-header .mdx-file-icon')),
        types: ['logo.svg', 'index.tsx', 'gittydocs.jsonc'].map(name => row(name).querySelector('svg').getAttribute('data-file-type')),
        decorative: [...document.querySelectorAll('.mdx-files svg, .mdx-file-spacer')].every(el => el.getAttribute('aria-hidden') === 'true') }
    })()`)
    const rows = state.rows
    expect(rows.static.name.x - rows.docs.name.x).toBe(24)
    expect(rows["logo.svg"].name.x - rows.static.name.x).toBe(24)
    expect(rows["gittydocs.jsonc"].name.x).toBe(rows.static.name.x)
    expect(rows["root.txt"].name.x).toBe(rows.docs.name.x)
    expect(rows["gittydocs.jsonc"].icon.x).toBe(rows.static.icon.x)
    expect(rows["logo.svg"].icon.x).toBe(rows["index.tsx"].icon.x)
    for (const row of Object.values(rows) as { icon: { width: number; height: number } }[]) {
      expect(row.icon.width).toBe(18)
      expect(row.icon.height).toBe(18)
    }
    expect(state.header.width).toBe(14)
    expect(state.header.height).toBe(14)
    expect(
      rows["index.tsx"].row.y - rows["logo.svg"].row.y - rows["logo.svg"].row.height
    ).toBeCloseTo(2, 1)
    expect(
      rows["README.md"].row.y - rows["gittydocs.jsonc"].row.y - rows["gittydocs.jsonc"].row.height
    ).toBeCloseTo(2, 1)
    expect(state.guides).toHaveLength(2)
    for (const guide of state.guides) {
      expect(guide.width).toBe("1px")
      expect(guide.position).toBe("absolute")
      expect(guide.border).toBe("0px")
      expect(guide.color).toBe(guide.expected)
    }
    expect(state.types).toEqual(["image", "react", "json"])
    expect(state.decorative).toBe(true)
  })

  test("native summary is keyboard focusable, visibly focused and toggles with Enter/Space", async () => {
    await evaluate(`document.querySelectorAll('summary')[2].focus()`)
    await command("press", "Enter")
    await settle()
    expect(await evaluate(`document.querySelectorAll('details')[2].open`)).toBe(true)
    const state = await evaluate(`(() => {
      const summary = document.querySelectorAll('summary')[2]
      const style = getComputedStyle(summary)
      return { focused: document.activeElement === summary, focusVisible: summary.matches(':focus-visible'),
        outline: style.outlineStyle, width: style.outlineWidth,
        childVisible: summary.nextElementSibling.checkVisibility({ contentVisibilityAuto: true }),
        rotation: getComputedStyle(summary.querySelector('svg')).transform }
    })()`)
    expect(state.focused).toBe(true)
    expect(state.focusVisible).toBe(true)
    expect(state.outline).toBe("solid")
    expect(state.width).toBe("2px")
    expect(state.childVisible).toBe(true)
    expect(state.rotation).toBe("matrix(0, 1, -1, 0, 0, 0)")
    await command("press", "Space")
    await settle()
    expect(await evaluate(`document.querySelectorAll('details')[2].open`)).toBe(false)
    expect(
      await evaluate(
        `document.querySelectorAll('summary')[2].nextElementSibling.checkVisibility({ contentVisibilityAuto: true })`
      )
    ).toBe(false)
  })

  test("DocsNav hover paints the outer row only and chevron color remains muted", async () => {
    const read = () =>
      evaluate(`(() => {
      const link = document.querySelector('aside a[href="/other"]')
      const row = link.parentElement, toggle = row.querySelector('button'), svg = toggle.querySelector('svg')
      const style = el => getComputedStyle(el)
      return { row: style(row).backgroundColor, link: style(link).backgroundColor, toggle: style(toggle).backgroundColor,
        color: style(svg).color, transition: style(svg).transitionProperty, transform: style(svg).transform, rotate: style(svg).rotate,
        label: toggle.getAttribute('aria-label'), expanded: toggle.getAttribute('aria-expanded') }
    })()`)
    await command("hover", "main")
    await settle()
    const before = await read()
    await command("hover", 'aside a[href="/other"]')
    await settle()
    const hover = await read()
    expect(hover.row).not.toBe(before.row)
    expect(hover.row).not.toBe("rgba(0, 0, 0, 0)")
    expect(hover.link).toBe("rgba(0, 0, 0, 0)")
    expect(hover.toggle).toBe("rgba(0, 0, 0, 0)")
    expect(hover.color).toBe(before.color)
    expect(hover.transition.split(", ")).toContain("transform")
    expect(hover.transition).not.toContain("color")
    expect(hover.transition).not.toContain("all")
    expect(hover.expanded).toBe("false")
    await command("click", 'button[aria-label="Expand Other section"]')
    await settle()
    const opened = await read()
    expect(opened.expanded).toBe("true")
    expect(opened.label).toBe("Collapse Other section")
    expect(opened.rotate).not.toBe(before.rotate)
    expect(opened.rotate).toBe("180deg")
    expect(opened.color).toBe(before.color)
    const active = await evaluate(`(() => {
      const link = document.querySelector('aside a[href="/guide"]')
      return { current: link.getAttribute('aria-current'), row: getComputedStyle(link.parentElement).backgroundColor,
        link: getComputedStyle(link).backgroundColor, toggle: getComputedStyle(link.parentElement.querySelector('button')).backgroundColor }
    })()`)
    expect(active.current).toBe("page")
    expect(active.row).not.toBe("rgba(0, 0, 0, 0)")
    expect(active.link).toBe("rgba(0, 0, 0, 0)")
    expect(active.toggle).toBe("rgba(0, 0, 0, 0)")
  })

  test("reduced motion disables disclosure/chevron animations without disabling interaction", async () => {
    await evaluate(`document.querySelector('button[aria-label="Expand Other section"]')?.click()`)
    await settle()
    await command("set", "media", "light", "reduced-motion")
    await command("click", "summary >> text=closed")
    const state = await evaluate(`(async () => {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const details = document.querySelectorAll('details')[2]
      const nav = document.querySelector('button[aria-label="Collapse Other section"]')
      nav.click()
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      return { reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, open: details.open,
        visible: details.querySelector('.mdx-disclosure-content').getBoundingClientRect().height > 0,
        treeTransition: getComputedStyle(details.querySelector('svg')).transitionDuration,
        bodyTransition: getComputedStyle(details, '::details-content').transitionDuration,
        navTransition: getComputedStyle(nav.querySelector('svg')).transitionProperty,
        expanded: nav.getAttribute('aria-expanded'), animations: document.getAnimations().filter(a => a.playState === 'running' &&
          (details.contains(a.effect?.target) || nav.contains(a.effect?.target))).length }
    })()`)
    expect(state.reduced).toBe(true)
    expect(state.open).toBe(true)
    expect(state.visible).toBe(true)
    expect(state.treeTransition).toBe("0s")
    expect(state.bodyTransition).toBe("0s")
    expect(state.navTransition).toBe("none")
    expect(state.expanded).toBe("false")
    expect(state.animations).toBe(0)
    expect((await command("errors")).errors).toEqual([])
  })
})
