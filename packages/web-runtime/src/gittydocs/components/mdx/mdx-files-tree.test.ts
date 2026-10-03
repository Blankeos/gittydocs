import { describe, expect, test } from "bun:test"
import { inferFileType } from "./file-type"

const assetsRoot = new URL("../../../assets/icons/", import.meta.url)

// Explicit asset contracts, not the spelling/order of component imports or barrels.
const languageAssets = [
  "javascript",
  "typescript",
  "react",
  "json",
  "markdown",
  "css",
  "html5",
  "yaml",
  "python",
  "rust",
  "go",
  "docker",
].map((name) => `simple-icons_${name}.svg`)
const utilityAssets = [
  "file",
  "folder",
  "terminal-2",
  "file-settings",
  "photo",
  "file-text",
  "file-code",
].map((name) => `tabler_${name}.svg`)

describe("file icon asset contracts", () => {
  test("language and utility assets inherit text color and retain upstream provenance", async () => {
    for (const filename of [...languageAssets, ...utilityAssets, "devicon:github.svg"]) {
      const svg = await Bun.file(new URL(`./${filename}`, assetsRoot)).text()
      const paints = [...svg.matchAll(/(?:fill|stroke)="([^"]+)"/g)].map((match) => match[1])
      expect(paints).toContain("currentColor")
      expect(paints.every((paint) => paint === "none" || paint === "currentColor")).toBe(true)
      expect(svg).toContain(
        filename === "devicon:github.svg" ? 'viewBox="0 0 128 128"' : 'viewBox="0 0 24 24"'
      )
      if (filename.startsWith("tabler_")) {
        expect(svg).toContain('stroke-width="2"')
        expect(svg).toContain('stroke-linecap="round"')
      } else if (filename.startsWith("simple-icons_")) {
        expect(svg).toContain("<path")
        expect(svg).not.toContain('stroke-width="2"')
      }
    }
    // Stable upstream Simple Icons silhouettes, not replacement text badges.
    const js = await Bun.file(new URL("simple-icons_javascript.svg", assetsRoot)).text()
    expect(js).toContain("M0 0h24v24H0z")
    const react = await Bun.file(new URL("simple-icons_react.svg", assetsRoot)).text()
    expect(react).not.toContain("<text")
  })

  test("reported tree trio has distinct semantic types", () => {
    expect(inferFileType("logo.svg")).toBe("image")
    expect(inferFileType("gittydocs.jsonc")).toBe("json")
    expect(inferFileType("index.tsx")).toBe("react")
  })
})
