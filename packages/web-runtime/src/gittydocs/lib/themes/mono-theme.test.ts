import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { z } from "zod"
import { docsConfigFileSchema, docsConfigSchema } from "../config-schema"
import { themeRegistry } from "./theme-registry"

const css = readFileSync(new URL("../../styles/themes/mono.css", import.meta.url), "utf8")
const appCss = readFileSync(new URL("../../../styles/app.css", import.meta.url), "utf8")
const committedSchema = JSON.parse(
  readFileSync(new URL("../../../../../../gittydocs.schema.json", import.meta.url), "utf8")
)

function tokens(selector: string): Record<string, string> {
  const block = css.slice(css.indexOf(`${selector} {`)).split("}")[0]
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2]])
  )
}

const light = tokens(':root[data-theme="mono"]')
const dark = tokens(':root[data-theme="mono"].dark')

function luminance(hex: string): number {
  const rgb = hex.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i)
  if (!rgb) throw new Error(`Expected hex color: ${hex}`)
  const [r, g, b] = rgb.slice(1).map((channel) => {
    const value = Number.parseInt(channel, 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const values = [luminance(a), luminance(b)].sort((x, y) => x - y)
  return (values[1] + 0.05) / (values[0] + 0.05)
}

describe("Mono theme", () => {
  test("registers and accepts mono while rejecting unknown presets", () => {
    expect(themeRegistry.find((theme) => theme.id === "mono")?.label).toBe("Mono")
    expect(docsConfigSchema.parse({ theme: { preset: "mono" } }).theme?.preset).toBe("mono")
    expect(docsConfigSchema.safeParse({ theme: { preset: "unknown" } }).success).toBe(false)
    const generated = z.toJSONSchema(docsConfigFileSchema, { target: "draft-07" })
    expect(generated.properties?.theme).toEqual(committedSchema.properties.theme)
    const presets = committedSchema.properties.theme.properties.preset.enum
    expect(presets).toEqual(themeRegistry.map((theme) => theme.id))
  })

  test("bundles the theme CSS without changing the default theme", () => {
    expect(appCss).toContain('@import "../gittydocs/styles/themes/mono.css";')
    expect([...css.matchAll(/([^{}]+)\{/g)].map((match) => match[1].trim())).toEqual([
      ':root[data-theme="mono"]',
      ':root[data-theme="mono"].dark',
    ])
  })

  test("overrides all existing preset colors and code controls in both modes", () => {
    const slate = readFileSync(new URL("../../styles/themes/slate.css", import.meta.url), "utf8")
    const required = new Set([
      ...[...slate.matchAll(/--([\w-]+):/g)].map((match) => match[1]),
      ...[...appCss.matchAll(/--((?:code-block|success|warning|error|info)[\w-]*):/g)].map(
        (match) => match[1]
      ),
    ])
    expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort())
    for (const token of required) {
      expect(light[token]).toBeDefined()
      expect(dark[token]).toBeDefined()
    }
    expect(light.background).toBe("#ffffff")
    expect(dark.background).toBe("#000000")
    for (const mode of [light, dark]) {
      for (const token of ["primary", "background", "foreground", "border", "sidebar"]) {
        expect(mode[token]).toMatch(/^#([\da-f]{2})\1\1$/i)
      }
    }
  })

  for (const [name, mode] of Object.entries({ light, dark })) {
    test(`${name} text, actions, code, and alert colors meet AA contrast`, () => {
      for (const surface of ["background", "card", "popover", "secondary", "muted", "accent"]) {
        const foreground = surface === "background" ? "foreground" : `${surface}-foreground`
        expect(contrast(mode[surface], mode[foreground])).toBeGreaterThanOrEqual(4.5)
      }
      for (const surface of ["primary", "sidebar", "sidebar-primary", "sidebar-accent"]) {
        expect(contrast(mode[surface], mode[`${surface}-foreground`])).toBeGreaterThanOrEqual(4.5)
      }
      for (const status of ["success", "error", "info", "destructive"]) {
        expect(contrast(mode[status], mode.background)).toBeGreaterThanOrEqual(4.5)
        expect(contrast(mode[status], mode[`${status}-foreground`])).toBeGreaterThanOrEqual(4.5)
      }
      expect(contrast(mode["warning-foreground"], mode.background)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(mode["code-block-fg"], mode["code-block-bg"])).toBeGreaterThanOrEqual(4.5)
      expect(
        contrast(mode["code-block-button-copied"], mode["code-block-bg"])
      ).toBeGreaterThanOrEqual(4.5)
    })
  }
})
