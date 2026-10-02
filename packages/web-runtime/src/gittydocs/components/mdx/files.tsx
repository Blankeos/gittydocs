import { type FlowProps, onCleanup, onMount, Show } from "solid-js"
import { animateDisclosure } from "./disclosure-animation"
import { DisclosureChevron, FileIcon, FolderIcon } from "./icons"

export type FilesProps = FlowProps
export type FolderProps = FlowProps<{ name: string; defaultOpen?: boolean }>
export type FileProps = { name: string; description?: string; icon?: string }

export function Files(props: FilesProps) {
  return (
    <div class="mdx-files">
      <ul class="mdx-files-list" aria-label="Files">
        {props.children}
      </ul>
    </div>
  )
}

export function Folder(props: FolderProps) {
  let details!: HTMLDetailsElement
  let content!: HTMLDivElement
  onMount(() => onCleanup(animateDisclosure(details, content)))

  return (
    <li class="mdx-folder">
      <details class="mdx-folder-disclosure" open={props.defaultOpen ?? false} ref={details}>
        <summary class="mdx-folder-trigger">
          <DisclosureChevron />
          <FolderIcon />
          <span class="mdx-file-name">{props.name}</span>
        </summary>
        <div class="mdx-disclosure-content" ref={content}>
          <ul class="mdx-files-list mdx-folder-children">{props.children}</ul>
        </div>
      </details>
    </li>
  )
}

export function File(props: FileProps) {
  return (
    <li class="mdx-file">
      <span class="mdx-file-spacer" aria-hidden="true" />
      <FileIcon name={props.name} icon={props.icon} />
      <span class="mdx-file-name">{props.name}</span>
      <Show when={props.description}>
        <span class="mdx-file-description">{props.description}</span>
      </Show>
    </li>
  )
}
