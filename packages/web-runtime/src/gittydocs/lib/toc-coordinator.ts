import {
  createTocState,
  getScrollActiveSlug,
  isScrollKey,
  reduceTocState,
  slugFromHash,
  type TocEvent,
} from "./toc-state"

export const TOC_HEADER_OFFSET = 92

export interface TocCoordinatorOptions {
  slugs: readonly string[]
  window: Window
  document: Document
  offset?: number
  onActiveChange: (slug: string | null) => void
}

/** One browser coordinator per page, shared by every ToC presentation on that page. */
export function createTocCoordinator(options: TocCoordinatorOptions) {
  const { window: win, document: doc, slugs } = options
  const offset = options.offset ?? TOC_HEADER_OFFSET
  // The browser URL is authoritative on the client: Vike's context can still
  // contain the previous hash after a same-page history.pushState/search jump.
  let state = createTocState(slugs, win.location.hash)
  let frame: number | null = null
  let disposed = false
  let pendingHashScroll = state.pinnedSlug
  const cleanups: (() => void)[] = []

  function dispatch(event: TocEvent) {
    const previous = state.activeSlug
    state = reduceTocState(state, event)
    if (state.activeSlug !== previous) options.onActiveChange(state.activeSlug)
  }

  function scrollToHeading(slug: string, smooth: boolean) {
    const element = doc.getElementById(slug)
    if (!element) return false
    const reducedMotion = win.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    win.scrollTo({
      top: Math.max(0, win.scrollY + element.getBoundingClientRect().top - offset),
      behavior: smooth && !reducedMotion ? "smooth" : "instant",
    })
    return true
  }

  function measure() {
    if (disposed) return
    if (pendingHashScroll && scrollToHeading(pendingHashScroll, false)) pendingHashScroll = null
    const positions = slugs.flatMap((slug) => {
      const element = doc.getElementById(slug)
      return element ? [{ slug, top: element.getBoundingClientRect().top }] : []
    })
    const root = doc.scrollingElement ?? doc.documentElement
    const atBottom = win.scrollY > 0 && win.scrollY + win.innerHeight >= root.scrollHeight - 2
    dispatch({ type: "scroll", slug: getScrollActiveSlug(positions, offset, atBottom) })
  }

  function schedule() {
    if (disposed || frame !== null) return
    frame = win.requestAnimationFrame(() => {
      frame = null
      measure()
    })
  }

  function release() {
    pendingHashScroll = null
    dispatch({ type: "intent" })
    // Measure after the browser has applied the input's default scroll action.
    schedule()
  }

  function onWheel(event: WheelEvent) {
    if (!event.defaultPrevented && !event.ctrlKey && (event.deltaX || event.deltaY)) release()
  }

  function onTouchMove(event: TouchEvent) {
    if (!event.defaultPrevented) release()
  }

  function onKeyDown(event: KeyboardEvent) {
    const target = event.target as Element | null
    const editable = Boolean(
      target?.closest?.(
        'input, textarea, select, button, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="listbox"], [role="slider"], [role="spinbutton"], [role="menu"], [role="dialog"]'
      )
    )
    if (
      isScrollKey({
        key: event.key,
        defaultPrevented: event.defaultPrevented,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        editable,
      })
    )
      release()
  }

  function onScrollbarDown(event: MouseEvent) {
    if (event.button !== 0) return
    const target = event.target
    if (target !== doc.documentElement && target !== doc.body && target !== doc) return
    const width = doc.documentElement.clientWidth
    const gutter = win.innerWidth - width
    // Include overlay scrollbars, but only on root targets; ordinary links never release the pin.
    if (
      event.clientX >= (gutter > 0 ? width : win.innerWidth - 2) ||
      (gutter > 0 && event.clientX <= gutter)
    )
      release()
  }

  function onHashNavigation() {
    const slug = slugFromHash(win.location.hash)
    if (slug && slugs.includes(slug)) {
      dispatch({ type: "select", slug })
      pendingHashScroll = slug
    } else {
      pendingHashScroll = null
      dispatch({ type: "reset", slugs })
    }
    schedule()
  }

  function listen<K extends keyof WindowEventMap>(
    type: K,
    listener: (event: WindowEventMap[K]) => void,
    eventOptions?: AddEventListenerOptions
  ) {
    win.addEventListener(type, listener, eventOptions)
    cleanups.push(() => win.removeEventListener(type, listener, eventOptions))
  }

  listen("scroll", schedule, { passive: true })
  listen("resize", schedule, { passive: true })
  listen("wheel", onWheel, { passive: true })
  listen("touchmove", onTouchMove, { passive: true })
  listen("keydown", onKeyDown)
  listen("pointerdown", onScrollbarDown, { capture: true, passive: true })
  listen("mousedown", onScrollbarDown, { capture: true, passive: true })
  listen("hashchange", onHashNavigation)
  listen("popstate", onHashNavigation)

  // Layout changes (images, fonts, dynamic MDX) also need a measurement, even without scrolling.
  const browser = win as Window & typeof globalThis
  if (browser.ResizeObserver) {
    const observer = new browser.ResizeObserver(schedule)
    observer.observe(doc.documentElement)
    if (doc.body) observer.observe(doc.body)
    cleanups.push(() => observer.disconnect())
  }
  if (browser.MutationObserver && doc.body) {
    const observer = new browser.MutationObserver(schedule)
    observer.observe(doc.body, { childList: true, subtree: true })
    cleanups.push(() => observer.disconnect())
  }

  options.onActiveChange(state.activeSlug)
  schedule()

  return {
    navigate(slug: string): boolean {
      if (disposed || !slugs.includes(slug) || !doc.getElementById(slug)) return false
      pendingHashScroll = null
      dispatch({ type: "select", slug })
      // pushState does not emit hashchange; the shared state above updates immediately.
      win.history.pushState(win.history.state, "", `#${encodeURIComponent(slug)}`)
      scrollToHeading(slug, true)
      return true
    },
    dispose() {
      disposed = true
      if (frame !== null) win.cancelAnimationFrame(frame)
      frame = null
      for (const cleanup of cleanups) cleanup()
    },
  }
}
