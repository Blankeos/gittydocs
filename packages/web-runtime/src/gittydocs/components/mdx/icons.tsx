import { Dynamic } from "solid-js/web"
import {
  IconChevronRight,
  IconFileCode,
  IconFileConfig,
  IconFileCss,
  IconFileDocker,
  IconFileGeneric,
  IconFileGo,
  IconFileHtml,
  IconFileImage,
  IconFileJs,
  IconFileJson,
  IconFileMarkdown,
  IconFilePython,
  IconFileReact,
  IconFileRust,
  IconFileShell,
  IconFileText,
  IconFileTypescript,
  IconFileYaml,
  IconFolderTree,
} from "@/assets/icons"
import { type FileType, inferFileType } from "./file-type"

// Simple Icons language/format logos (as in Fumadocs), Tabler utility icons.
// Bundled via iconmate; all inherit currentColor without theme-specific variants.
const fileIcons = {
  file: IconFileGeneric,
  javascript: IconFileJs,
  typescript: IconFileTypescript,
  react: IconFileReact,
  json: IconFileJson,
  markdown: IconFileMarkdown,
  css: IconFileCss,
  html: IconFileHtml,
  yaml: IconFileYaml,
  shell: IconFileShell,
  python: IconFilePython,
  rust: IconFileRust,
  go: IconFileGo,
  config: IconFileConfig,
  image: IconFileImage,
  docker: IconFileDocker,
  text: IconFileText,
  code: IconFileCode,
} satisfies Record<FileType, typeof IconFileGeneric>

export function FileIcon(props: { name: string; icon?: string }) {
  const type = () => inferFileType(props.name, props.icon)

  return (
    <Dynamic
      component={fileIcons[type()]}
      class="mdx-file-icon"
      data-file-type={type()}
      aria-hidden="true"
    />
  )
}

export function FolderIcon() {
  return <IconFolderTree class="mdx-file-icon" aria-hidden="true" />
}

export function DisclosureChevron() {
  return <IconChevronRight class="mdx-disclosure-chevron" aria-hidden="true" />
}
