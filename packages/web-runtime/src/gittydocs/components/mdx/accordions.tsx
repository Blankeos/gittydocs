import { createEffect, createUniqueId, type FlowProps, onCleanup, onMount } from "solid-js"
import { animateDisclosure } from "./disclosure-animation"
import { DisclosureChevron } from "./icons"

export type AccordionsProps = FlowProps<{ type?: "single" | "multiple" }>
export type AccordionProps = FlowProps<{ title: string; id?: string; defaultOpen?: boolean }>

export function Accordions(props: AccordionsProps) {
  const name = `mdx-accordions-${createUniqueId()}`
  let container: HTMLDivElement | undefined
  const items = () =>
    Array.from(
      container?.querySelectorAll<HTMLDetailsElement>("details.mdx-accordion") ?? []
    ).filter((item) => item.closest(".mdx-accordions") === container)

  // MDX constructs children before invoking their parent component, so group
  // behavior must not depend on Accordion receiving a Solid context at creation.
  onMount(() => {
    const syncItems = () => {
      const single = props.type !== "multiple"
      let hasOpen = false
      for (const item of items()) {
        if (single && item.open) {
          if (hasOpen) item.open = false
          hasOpen = true
        }
        if (single) item.setAttribute("name", name)
        else item.removeAttribute("name")
      }
    }
    createEffect(syncItems)
    const observer = new MutationObserver(syncItems)
    if (container) observer.observe(container, { childList: true, subtree: true })
    onCleanup(() => observer.disconnect())

    // Native `name` supports exclusivity, including browser-find expansion.
    // Capture non-bubbling toggle events as a fallback for older browsers.
    const handleToggle = (event: Event) => {
      if (props.type === "multiple") return
      const target = event.target
      if (!(target instanceof HTMLDetailsElement) || !target.open) return
      if (target.closest(".mdx-accordions") !== container) return
      if (!target.classList.contains("mdx-accordion")) return
      for (const other of items()) {
        if (other !== target) other.open = false
      }
    }
    container?.addEventListener("toggle", handleToggle, true)
    onCleanup(() => container?.removeEventListener("toggle", handleToggle, true))
  })

  return (
    <div class="mdx-accordions" ref={container}>
      {props.children}
    </div>
  )
}

export function Accordion(props: AccordionProps) {
  const generatedId = `mdx-accordion-${createUniqueId()}`
  const id = () => props.id ?? generatedId
  let details!: HTMLDetailsElement
  let content!: HTMLDivElement
  onMount(() => onCleanup(animateDisclosure(details, content)))

  return (
    <details class="mdx-accordion" id={id()} open={props.defaultOpen ?? false} ref={details}>
      <summary class="mdx-accordion-trigger" id={`${id()}-trigger`}>
        <span>{props.title}</span>
        <DisclosureChevron />
      </summary>
      <div class="mdx-disclosure-content" ref={content}>
        <section class="mdx-accordion-body" aria-labelledby={`${id()}-trigger`}>
          {props.children}
        </section>
      </div>
    </details>
  )
}
