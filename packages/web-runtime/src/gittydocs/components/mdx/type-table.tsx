import { For, type JSX, onCleanup, onMount, Show } from "solid-js"
import { animateDisclosure } from "./disclosure-animation"
import { DisclosureChevron } from "./icons"

export interface TypeTableProperty {
  type: string
  description?: JSX.Element
  default?: string
  required?: boolean
  deprecated?: boolean
}
export interface TypeTableProps {
  type: Record<string, TypeTableProperty>
  caption?: string
}

export function TypeTable(props: TypeTableProps) {
  return (
    <section class="mdx-type-table" aria-label={props.caption ?? "Type reference"}>
      <Show when={props.caption}>
        <div class="mdx-type-table-caption">{props.caption}</div>
      </Show>
      <div class="mdx-type-table-frame">
        <div class="mdx-type-table-heading" aria-hidden="true">
          <span>Prop</span>
          <span>Type</span>
        </div>
        <For each={Object.entries(props.type)}>
          {([name, property]) => <TypeRow name={name} property={property} />}
        </For>
      </div>
    </section>
  )
}

function TypeRow(props: { name: string; property: TypeTableProperty }) {
  let details!: HTMLDetailsElement
  let content!: HTMLDivElement
  onMount(() => onCleanup(animateDisclosure(details, content)))
  return (
    <details class="mdx-type-row" ref={details}>
      <summary class="mdx-type-trigger">
        <span class="mdx-type-name">
          <code>{props.name}</code>
          <Show when={props.property.required}>
            <span class="mdx-type-badge">Required</span>
          </Show>
          <Show when={props.property.deprecated}>
            <span class="mdx-type-badge">Deprecated</span>
          </Show>
        </span>
        <code class="mdx-type-value">{props.property.type}</code>
        <DisclosureChevron />
      </summary>
      <div class="mdx-disclosure-content" ref={content}>
        <div class="mdx-type-details">
          <Show when={props.property.description !== undefined}>
            <div class="mdx-type-description">{props.property.description}</div>
          </Show>
          <Show when={props.property.default !== undefined}>
            <dl class="mdx-type-default">
              <dt>Default</dt>
              <dd>
                <code>{props.property.default}</code>
              </dd>
            </dl>
          </Show>
        </div>
      </div>
    </details>
  )
}
