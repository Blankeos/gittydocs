import { describe, expect, test } from "bun:test"
import { inferFileType } from "./file-type"

const cssUrl = new URL("../../styles/mdx-components.css", import.meta.url)
const filesUrl = new URL("./files.tsx", import.meta.url)
const iconsUrl = new URL("./icons.tsx", import.meta.url)
const barrelUrl = new URL("../../../assets/icons/index.ts", import.meta.url)

async function read(url: URL) {
  return await Bun.file(url).text()
}

describe("mdx files tree indentation and branch lines", () => {
  test("code-block header icons are compact without shrinking file-tree icons", async () => {
    const css = await read(cssUrl)
    expect(css).toMatch(/\.prose \.mdx-file-icon\s*\{[^}]*width:\s*1\.125rem/)
    expect(css).toMatch(
      /\.prose \.code-block\[data-titled="true"\] \.mdx-file-icon\s*\{[^}]*width:\s*0\.875rem;[^}]*height:\s*0\.875rem;/
    )
  })

  test("collapsible heading links leave the hover background entirely to the outer row", async () => {
    const nav = await read(new URL("../docs/docs-nav.tsx", import.meta.url))
    expect(nav).toContain("groupHeading={item().accordion === true}")
    expect(nav).toContain('"background-color": props.groupHeading ? "transparent" : undefined')
    expect(nav).toMatch(
      /props\.groupHeading\s*\? "bg-transparent transition-\[color\]"\s*: "transition-colors hover:bg-accent"/
    )
    expect(nav).toContain('props.active && !props.groupHeading && "bg-accent"')
    expect(nav).not.toContain("[&>a]:bg-transparent")
  })

  test("sidebar chevrons keep a fixed muted color instead of trailing hover transitions", async () => {
    const nav = await read(new URL("../docs/docs-nav.tsx", import.meta.url))
    const chevron = nav.slice(nav.indexOf("function NavChevron("))
    expect(chevron).toContain("text-muted-foreground transition-transform")
    expect(chevron).not.toContain("transition-colors")
    expect(nav).not.toMatch(/class="[^"]*group-hover\/nav-heading:text-accent-foreground"/)
  })

  test("file rows reserve the chevron slot instead of magic left padding", async () => {
    const [css, files] = await Promise.all([read(cssUrl), read(filesUrl)])
    expect(css).not.toMatch(/\.mdx-file\s*\{[^}]*padding-left:\s*2rem/)
    expect(css).toMatch(/\.mdx-file-spacer/)
    expect(css).toMatch(/\.mdx-file-spacer\s*\{[^}]*width:\s*1rem/)
    expect(files).toMatch(/mdx-file-spacer/)
    expect(files).toMatch(/aria-hidden/)
  })

  test("nested guides use a single positioned pseudo per level", async () => {
    const css = await read(cssUrl)
    // One guide per .mdx-folder-children, drawn without shifting layout.
    expect(css).toMatch(/\.mdx-folder-children::before/)
    expect(css).toMatch(/\.mdx-folder-children::before[^}]*background:\s*var\(--border\)/)
    // The old box border doubled visually with nesting and drifted 1px per level.
    expect(css).not.toMatch(/\.mdx-folder-children\s*\{[^}]*border-left/)
    // 1rem margin centers under the parent chevron; 0.5rem padding compounds to
    // exactly one 1.5rem indent per level so children align under parent icons.
    expect(css).toMatch(/\.mdx-folder-children\s*\{[^}]*margin:[^;]*1rem/)
    expect(css).toMatch(/\.mdx-folder-children\s*\{[^}]*padding-left:\s*0\.5rem/)
  })

  test("lists stack rows with a shared gap at every depth", async () => {
    const css = await read(cssUrl)
    expect(css).toMatch(/ul\.mdx-files-list\s*\{[^}]*display:\s*flex/)
    expect(css).toMatch(/ul\.mdx-files-list\s*\{[^}]*flex-direction:\s*column/)
  })

  test("folder disclosure behavior and accessibility hooks are preserved", async () => {
    const [css, files] = await Promise.all([read(cssUrl), read(filesUrl)])
    expect(files).toMatch(/animateDisclosure/)
    expect(files).toMatch(/<details/)
    expect(files).toMatch(/<summary/)
    expect(css).toMatch(/\.mdx-disclosure-chevron/)
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/)
    expect(css).toMatch(/:focus-visible/)
  })

  test("the shared GitHub brand mark inherits the surrounding text color", async () => {
    const svg = await read(new URL("./devicon:github.svg", barrelUrl))
    expect(svg).toContain('fill="currentColor"')
    expect(svg).not.toMatch(/(?:fill|stroke)="(?:#|rgb|hsl)/)
  })

  test("header and footer reuse the shared GitHub icon rather than inline variants", async () => {
    for (const name of ["docs-header", "docs-footer"]) {
      const source = await read(new URL(`../docs/${name}.tsx`, import.meta.url))
      expect(source).toContain("<IconGitHub ")
      expect(source).not.toContain("M12 0c-6.626")
    }
  })
})

describe("mdx file icon set", () => {
  test("reported tree trio keeps distinct coherent types", () => {
    // docs/introduction.mdx: Folder "[static]" > File "logo.svg" + sibling "gittydocs.jsonc".
    expect(inferFileType("logo.svg")).toBe("image")
    expect(inferFileType("gittydocs.jsonc")).toBe("json")
    expect(inferFileType("index.tsx")).toBe("react")
  })

  test("tsx/jsx map to the monochrome React atom asset", async () => {
    const icons = await read(iconsUrl)
    expect(icons).toMatch(/IconFileReact/)
    expect(icons).toMatch(/react:\s*IconFileReact/)
    expect(icons).toMatch(/data-file-type/)
    expect(icons).toMatch(/aria-hidden/)
    expect(inferFileType("index.tsx")).toBe("react")
    // Real file-type pack, not handcrafted line art or text badges.
    expect(icons).not.toMatch(/<ellipse/)
    expect(icons).not.toMatch(/<text/)
    expect(icons).not.toMatch(/textLength/)
  })

  test("file vocabulary covers every inferred type with real assets", async () => {
    const [icons, barrel] = await Promise.all([read(iconsUrl), read(barrelUrl)])
    for (const name of [
      "IconFileGeneric",
      "IconFileJs",
      "IconFileTypescript",
      "IconFileReact",
      "IconFileJson",
      "IconFileMarkdown",
      "IconFileCss",
      "IconFileHtml",
      "IconFileYaml",
      "IconFileShell",
      "IconFilePython",
      "IconFileRust",
      "IconFileGo",
      "IconFileConfig",
      "IconFileImage",
      "IconFileDocker",
      "IconFileText",
      "IconFileCode",
    ]) {
      expect(icons).toContain(name)
      expect(barrel).toContain(name)
    }
    expect(icons).toMatch(/satisfies Record<FileType/)
    expect(icons).toMatch(/inferFileType/)
  })

  test("folder and disclosure reuse real shared assets", async () => {
    const icons = await read(iconsUrl)
    expect(icons).toMatch(/IconFolderTree/)
    expect(icons).toMatch(/IconChevronRight/)
    expect(icons).toMatch(/mdx-file-icon/)
    expect(icons).toMatch(/mdx-disclosure-chevron/)
    expect(icons).not.toMatch(/M3 7a2 2 0 0 1 2-2h4l2 2h8/)
  })

  test("language logos use Simple Icons and utility icons keep Tabler outlines", async () => {
    const barrel = await read(barrelUrl)
    for (const [name, asset] of Object.entries({
      Js: "javascript",
      Typescript: "typescript",
      React: "react",
      Json: "json",
      Markdown: "markdown",
      Css: "css",
      Html: "html5",
      Yaml: "yaml",
      Python: "python",
      Rust: "rust",
      Go: "go",
      Docker: "docker",
    })) {
      expect(barrel).toContain(
        `export { default as IconFile${name} } from "./simple-icons_${asset}.svg"`
      )
    }
    expect(barrel).toContain('IconFolderTree } from "./tabler_folder.svg"')
    expect(barrel).toContain('IconFileGeneric } from "./tabler_file.svg"')
    const javascript = await read(new URL("./simple-icons_javascript.svg", barrelUrl))
    expect(javascript).toContain('fill="currentColor"')
    expect(javascript).toContain("M0 0h24v24H0z")
    expect(javascript).not.toContain('stroke-width="2"')
  })

  test("all file and folder assets use currentColor rather than fixed brand colors", async () => {
    const barrel = await read(barrelUrl)
    const assets = [
      ...barrel.matchAll(/export \{ default as Icon(?:File\w+|FolderTree) \} from "(.+)"/g),
    ]
    expect(assets).toHaveLength(19)
    for (const [, filename] of assets) {
      expect(filename).toMatch(/\/(?:simple-icons|tabler)_/)
      const svg = await read(new URL(filename, barrelUrl))
      const paints = [...svg.matchAll(/(?:fill|stroke)="([^"]+)"/g)].map((match) => match[1])
      expect(paints).toContain("currentColor")
      expect(paints.every((paint) => paint === "none" || paint === "currentColor")).toBe(true)
    }
  })
})
