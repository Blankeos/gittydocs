import { describe, expect, test } from "bun:test"
import { inferFileType } from "./file-type"

describe("filename icon inference", () => {
  test.each([
    ["config.js", "javascript"],
    ["src/component.JSX", "react"],
    ["src/app.tsx", "react"],
    ["src/App.TSX", "react"],
    ["config.d.ts", "typescript"],
    ["package.json", "json"],
    ["settings.jsonc", "json"],
    ["guide.mdx", "markdown"],
    ["theme.scss", "css"],
    ["index.html", "html"],
    ["workflow.yml", "yaml"],
    ["script.sh", "shell"],
    ["app.py", "python"],
    ["main.rs", "rust"],
    ["main.go", "go"],
    ["settings.toml", "config"],
    ["logo.svg", "image"],
    ["Dockerfile", "docker"],
    ["Dockerfile.dev", "docker"],
    [".env.local", "config"],
    [".gitignore", "config"],
    ["README", "text"],
    ["bun.lock", "config"],
    ["C:\\src\\app.tsx", "react"],
    ["C:\\src\\app.ts", "typescript"],
    ["my config file.js", "javascript"],
    ["unknown.xyz", "file"],
    ["Makefile", "file"],
    ["", "file"],
    ["constructor", "file"],
    ["file.__proto__", "file"],
  ])("infers %s as %s", (name, expected) => {
    expect<string>(inferFileType(name)).toBe(expected)
  })

  test("supports curated icon overrides and a safe generic fallback", () => {
    expect(inferFileType("unknown.xyz", "typescript")).toBe("typescript")
    expect(inferFileType("unknown.xyz", " TS ")).toBe("typescript")
    expect(inferFileType("unknown.xyz", "react")).toBe("react")
    expect(inferFileType("unknown.xyz", " REACT ")).toBe("react")
    expect(inferFileType("unknown.xyz", "tsx")).toBe("react")
    expect(inferFileType("unknown.xyz", "jsx")).toBe("react")
    expect(inferFileType("app.tsx", "typescript")).toBe("typescript")
    expect(inferFileType("app.js", "terminal")).toBe("shell")
    expect(inferFileType("app.js", "file")).toBe("file")
    expect(inferFileType("app.js", "not-an-icon")).toBe("file")
    expect(inferFileType("app.js", "constructor")).toBe("file")
    expect(inferFileType("app.js", "__proto__")).toBe("file")
  })
})
