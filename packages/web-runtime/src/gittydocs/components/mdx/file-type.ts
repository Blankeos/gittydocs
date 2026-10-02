export const fileTypeLabels = {
  file: "",
  javascript: "JS",
  typescript: "TS",
  react: "RX",
  json: "{}",
  markdown: "MD",
  css: "CSS",
  html: "HTML",
  yaml: "YML",
  shell: "$",
  python: "PY",
  rust: "RS",
  go: "GO",
  config: "CFG",
  image: "IMG",
  docker: "DKR",
  text: "TXT",
  code: "</>",
} as const

export type FileType = keyof typeof fileTypeLabels

function owns(object: object, key: string): boolean {
  // Runtime's tsconfig targets ES2020; Object.hasOwn requires ES2022.
  // biome-ignore lint/suspicious/noPrototypeBuiltins: ES2020-compatible own-property check
  return Object.prototype.hasOwnProperty.call(object, key)
}

const extensions: Readonly<Record<string, FileType>> = {
  js: "javascript",
  jsx: "react",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "react",
  mts: "typescript",
  cts: "typescript",
  json: "json",
  jsonc: "json",
  md: "markdown",
  mdx: "markdown",
  css: "css",
  scss: "css",
  sass: "css",
  less: "css",
  html: "html",
  htm: "html",
  vue: "html",
  svelte: "html",
  yaml: "yaml",
  yml: "yaml",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  fish: "shell",
  py: "python",
  rs: "rust",
  go: "go",
  toml: "config",
  ini: "config",
  conf: "config",
  svg: "image",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  txt: "text",
  lock: "config",
}

const aliases: Readonly<Record<string, FileType>> = {
  ...extensions,
  generic: "file",
  terminal: "shell",
}

/** A deliberately small, local icon vocabulary shared by Files and code titles. */
export function inferFileType(name: string, icon?: string): FileType {
  if (icon !== undefined) {
    const key = icon.trim().toLowerCase()
    if (owns(fileTypeLabels, key)) return key as FileType
    return owns(aliases, key) ? aliases[key] : "file"
  }

  const filename = name.split(/[/\\]/).pop()?.toLowerCase() ?? ""
  if (/^dockerfile(?:\.|$)/.test(filename)) return "docker"
  if (/^\.env(?:\.|$)/.test(filename)) return "config"
  if ([".gitignore", ".gitattributes", ".npmrc", ".editorconfig"].includes(filename)) {
    return "config"
  }
  if (/^(?:readme|license|licence|changelog)$/.test(filename)) return "text"

  const dot = filename.lastIndexOf(".")
  if (dot < 0) return "file"
  const extension = filename.slice(dot + 1)
  return owns(extensions, extension) ? extensions[extension] : "file"
}
