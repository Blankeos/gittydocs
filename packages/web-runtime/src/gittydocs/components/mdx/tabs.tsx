import { createUniqueId, type FlowProps, For, onCleanup, onMount } from "solid-js"

export type TabsProps = FlowProps<{
  items: string[]
  defaultIndex?: number
  groupId?: string
  persist?: boolean
  label?: string
}>
export type TabProps = FlowProps<{ value: string }>

// MDX evaluates children before their parent, so panels deliberately need no context.
export function Tab(props: TabProps) {
  return (
    <div class="mdx-tab-panel" data-tab-value={props.value}>
      {props.children}
    </div>
  )
}

export function Tabs(props: TabsProps) {
  const id = `mdx-tabs-${createUniqueId()}`
  const defaultIndex = () =>
    props.items[props.defaultIndex ?? 0] !== undefined ? (props.defaultIndex ?? 0) : 0
  // Eager MDX children cannot read parent context during SSR. This scoped rule
  // hides inactive direct panels before hydration; hex escaping also keeps
  // arbitrary labels (including </style>) safe inside the inline stylesheet.
  const cssString = (value: string) =>
    Array.from(value, (character) => `\\${character.codePointAt(0)!.toString(16)} `).join("")
  const initialVisibility = () =>
    `.mdx-tabs[data-mdx-tabs="${cssString(id)}"]:not([data-tabs-ready]) > .mdx-tab-panel:not([data-tab-value="${cssString(props.items[defaultIndex()] ?? "")}"]) { display: none; }`
  let root!: HTMLDivElement
  onMount(() => {
    const buttons = () =>
      Array.from(root.querySelectorAll<HTMLButtonElement>("[role=tab]")).filter(
        (el) => el.closest(".mdx-tabs") === root
      )
    const panels = () =>
      Array.from(root.querySelectorAll<HTMLElement>(".mdx-tab-panel")).filter(
        (el) => el.closest(".mdx-tabs") === root
      )
    const storage = () => (props.persist ? localStorage : sessionStorage)
    const key = () => `gittydocs-tabs:${props.groupId}`
    const select = (value: string, broadcast = false) => {
      if (!props.items.includes(value)) return
      for (const [index, button] of buttons().entries()) {
        const active = props.items[index] === value
        button.setAttribute("aria-selected", String(active))
        button.tabIndex = active ? 0 : -1
      }
      for (const panel of panels()) panel.hidden = panel.dataset.tabValue !== value
      if (broadcast && props.groupId) {
        try {
          storage().setItem(key(), value)
        } catch {
          /* Storage can be disabled. */
        }
        window.dispatchEvent(
          new CustomEvent("gittydocs-tab-change", { detail: { group: props.groupId, value } })
        )
      }
    }
    for (const [index, button] of buttons().entries()) {
      button.id = `${id}-tab-${index}`
      button.setAttribute("aria-controls", `${id}-panel-${index}`)
    }
    for (const panel of panels()) {
      const index = props.items.indexOf(panel.dataset.tabValue ?? "")
      if (index < 0) continue
      panel.id = `${id}-panel-${index}`
      panel.setAttribute("role", "tabpanel")
      panel.setAttribute("aria-labelledby", `${id}-tab-${index}`)
      panel.tabIndex = 0
    }
    let initial = props.items[props.defaultIndex ?? 0] ?? props.items[0]
    if (props.groupId) {
      try {
        const saved = storage().getItem(key())
        if (saved && props.items.includes(saved)) initial = saved
      } catch {
        /* Keep default. */
      }
    }
    if (initial) select(initial)
    root.setAttribute("data-tabs-ready", "")
    const click = (event: MouseEvent) => {
      const button = (event.target as Element).closest<HTMLButtonElement>("[role=tab]")
      if (button && buttons().includes(button)) select(button.dataset.tabValue ?? "", true)
    }
    const keydown = (event: KeyboardEvent) => {
      const list = buttons()
      const index = list.indexOf(event.target as HTMLButtonElement)
      if (index < 0) return
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? list.length - 1
            : event.key === "ArrowRight"
              ? (index + 1) % list.length
              : event.key === "ArrowLeft"
                ? (index - 1 + list.length) % list.length
                : -1
      if (next < 0) return
      event.preventDefault()
      select(props.items[next]!, true)
      list[next]?.focus()
    }
    const sync = (event: Event) => {
      const detail = (event as CustomEvent).detail
      if (props.groupId && detail.group === props.groupId) select(detail.value)
    }
    const storageChange = (event: StorageEvent) => {
      if (props.groupId && event.key === key() && event.newValue) select(event.newValue)
    }
    root.addEventListener("click", click)
    root.addEventListener("keydown", keydown)
    window.addEventListener("gittydocs-tab-change", sync)
    window.addEventListener("storage", storageChange)
    onCleanup(() => {
      root.removeEventListener("click", click)
      root.removeEventListener("keydown", keydown)
      window.removeEventListener("gittydocs-tab-change", sync)
      window.removeEventListener("storage", storageChange)
    })
  })
  return (
    <div class="mdx-tabs" data-mdx-tabs={id} ref={root}>
      <style>{initialVisibility()}</style>
      <div class="mdx-tabs-list" role="tablist" aria-label={props.label ?? "Content tabs"}>
        <For each={props.items}>
          {(item, index) => (
            <button
              type="button"
              role="tab"
              class="mdx-tab-trigger"
              data-tab-value={item}
              id={`${id}-tab-${index()}`}
              aria-controls={`${id}-panel-${index()}`}
              aria-selected={index() === defaultIndex()}
              tabindex={index() === defaultIndex() ? 0 : -1}
            >
              {item}
            </button>
          )}
        </For>
      </div>
      {props.children}
    </div>
  )
}
