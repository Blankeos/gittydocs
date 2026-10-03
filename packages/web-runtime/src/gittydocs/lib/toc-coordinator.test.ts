import { describe, expect, test } from "bun:test"
import { createTocCoordinator } from "./toc-coordinator"

// A deterministic browser adapter: exercise the real coordinator's DOM/event boundary,
// without tying pure state tests to a rendering framework or elapsed-time sleeps.
function browserFixture(hash = "") {
  const events = new EventTarget()
  const frames = new Map<number, FrameRequestCallback>()
  const observerCallbacks: (() => void)[] = []
  let nextFrame = 0
  let scrollY = 0
  let reducedMotion = false
  let observerCount = 0
  let disconnected = 0
  let listenerCount = 0
  let pushedState: unknown
  const tops = new Map([
    ["first", 120],
    ["middle", 800],
    ["last", 1150],
  ])
  const scrolls: ScrollToOptions[] = []
  const history = {
    state: { router: true },
    pushState: (_state: unknown, _unused: string, value: string) => {
      pushedState = _state
      win.location.hash = value
    },
  }
  const root = { clientWidth: 1000, scrollHeight: 1200 }
  const body = {}
  class Observer {
    constructor(callback: () => void) {
      observerCount++
      observerCallbacks.push(callback)
    }
    observe() {}
    disconnect() {
      disconnected++
    }
  }
  const doc = {
    body,
    documentElement: root,
    scrollingElement: root,
    getElementById: (slug: string) =>
      tops.has(slug)
        ? { getBoundingClientRect: () => ({ top: (tops.get(slug) ?? 0) - scrollY }) }
        : null,
  }
  const win = {
    location: { hash },
    history,
    innerWidth: 1020,
    innerHeight: 600,
    get scrollY() {
      return scrollY
    },
    matchMedia: () => ({ matches: reducedMotion }),
    scrollTo: (options: ScrollToOptions) => {
      scrolls.push(options)
    },
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback)
      return nextFrame
    },
    cancelAnimationFrame: (id: number) => {
      frames.delete(id)
    },
    addEventListener: (type: string, listener: EventListener) => {
      listenerCount++
      events.addEventListener(type, listener)
    },
    removeEventListener: (type: string, listener: EventListener) => {
      listenerCount--
      events.removeEventListener(type, listener)
    },
    ResizeObserver: Observer,
    MutationObserver: Observer,
  }
  const active: (string | null)[] = []
  const coordinator = createTocCoordinator({
    slugs: [...tops.keys()],
    window: win as unknown as Window,
    document: doc as unknown as Document,
    onActiveChange: (slug) => active.push(slug),
  })
  function emit(type: string, fields: Record<string, unknown> = {}) {
    const event = new Event(type)
    for (const [key, value] of Object.entries(fields)) Object.defineProperty(event, key, { value })
    events.dispatchEvent(event)
  }
  function flush() {
    const callbacks = [...frames.values()]
    frames.clear()
    for (const callback of callbacks) callback(0)
  }
  return {
    coordinator,
    win,
    root,
    scrolls,
    active,
    emit,
    flush,
    moveTo: (top: number) => {
      scrollY = top
      emit("scroll")
      flush()
    },
    reducedMotion: () => {
      reducedMotion = true
    },
    current: () => active[active.length - 1],
    listeners: () => listenerCount,
    observers: () => observerCount,
    disconnected: () => disconnected,
    pendingFrames: () => frames.size,
    setHeadingTop: (slug: string, top: number) => tops.set(slug, top),
    removeHeading: (slug: string) => tops.delete(slug),
    layoutChanged: () => {
      for (const callback of observerCallbacks) callback()
    },
    latestHistoryState: () => pushedState,
  }
}

describe("browser ToC coordinator", () => {
  test("both presentations see the immediate pin through smooth scrolling and unreachable bottom", () => {
    const browser = browserFixture()
    browser.flush()
    expect(browser.coordinator.navigate("last")).toBe(true)
    expect(browser.current()).toBe("last")
    expect(browser.scrolls[browser.scrolls.length - 1]).toEqual({ top: 1058, behavior: "smooth" })
    expect(browser.win.location.hash).toBe("#last")
    expect(browser.latestHistoryState()).toBe(browser.win.history.state)
    browser.moveTo(300)
    expect(browser.current()).toBe("last")
    browser.moveTo(600)
    expect(browser.current()).toBe("last")
    browser.emit("click")
    browser.emit("pointerdown", { button: 0, clientX: 400 })
    browser.emit("keydown", { key: "a" })
    browser.emit("keydown", { key: "ArrowDown", target: { closest: () => ({}) } })
    browser.moveTo(0)
    expect(browser.current()).toBe("last")
    browser.emit("wheel", { deltaY: -30 })
    browser.flush()
    expect(browser.current()).toBe("first")
    browser.coordinator.dispose()
  })

  test("hash initialization waits for asynchronously inserted heading DOM without a timer", () => {
    const browser = browserFixture("#last")
    browser.removeHeading("last")
    browser.flush()
    expect(browser.current()).toBe("last")
    expect(browser.scrolls).toHaveLength(0)
    browser.setHeadingTop("last", 1150)
    browser.layoutChanged()
    browser.flush()
    expect(browser.scrolls[browser.scrolls.length - 1]).toEqual({ top: 1058, behavior: "instant" })
    expect(browser.current()).toBe("last")
    browser.coordinator.dispose()
  })

  test("non-scrolling gestures and prevented input leave the selected heading pinned", () => {
    const browser = browserFixture()
    browser.coordinator.navigate("last")
    for (const [type, fields] of [
      ["wheel", { deltaY: 0, deltaX: 0 }],
      ["wheel", { deltaY: 50, ctrlKey: true }],
      ["wheel", { deltaY: 50, defaultPrevented: true }],
      ["touchmove", { defaultPrevented: true }],
      ["keydown", { key: "End", ctrlKey: true }],
      ["keydown", { key: "PageDown", defaultPrevented: true }],
      ["pointerdown", { button: 0, clientX: 400, target: browser.root }],
    ] as const) {
      browser.emit(type, fields)
      browser.moveTo(0)
      expect(browser.current()).toBe("last")
    }
    browser.coordinator.dispose()
  })

  test("fast jumps, resizing, and layout changes update the default scroll spy", () => {
    const browser = browserFixture()
    browser.flush()
    browser.win.innerHeight = 200
    browser.moveTo(800)
    expect(browser.current()).toBe("middle")
    browser.moveTo(150)
    expect(browser.current()).toBe("first")
    browser.setHeadingTop("middle", 200)
    browser.layoutChanged()
    browser.flush()
    expect(browser.current()).toBe("middle")
    browser.setHeadingTop("middle", 800)
    browser.emit("resize")
    browser.flush()
    expect(browser.current()).toBe("first")
    browser.coordinator.dispose()
  })

  test("touchmove, scroll keys, and scrollbar dragging resume scroll spy, not ordinary clicks", () => {
    const browser = browserFixture()
    browser.flush()
    for (const [type, fields] of [
      ["touchmove", {}],
      ["keydown", { key: "PageUp" }],
      ["pointerdown", { button: 0, clientX: 1010, target: browser.root }],
      ["mousedown", { button: 0, clientX: 1010, target: browser.root }],
    ] as const) {
      browser.coordinator.navigate("last")
      browser.emit(type, fields)
      browser.flush()
      expect(browser.current()).toBe("first")
    }
    browser.coordinator.dispose()
  })

  test("initial hash, hash navigation, and back/forward select headings", () => {
    const browser = browserFixture("#last")
    expect(browser.current()).toBe("last")
    browser.flush()
    expect(browser.scrolls[browser.scrolls.length - 1]?.behavior).toBe("instant")
    browser.win.location.hash = "#middle"
    browser.emit("hashchange")
    expect(browser.current()).toBe("middle")
    browser.flush()
    browser.moveTo(0)
    expect(browser.current()).toBe("middle")
    browser.win.location.hash = "#first"
    browser.emit("popstate")
    expect(browser.current()).toBe("first")
    browser.win.location.hash = "#missing"
    browser.emit("hashchange")
    browser.moveTo(600)
    expect(browser.current()).toBe("last")
    browser.coordinator.dispose()
  })

  test("honors reduced motion and cancels frames, listeners, and observers on route disposal", () => {
    const browser = browserFixture()
    browser.reducedMotion()
    browser.coordinator.navigate("middle")
    expect(browser.scrolls[browser.scrolls.length - 1]?.behavior).toBe("instant")
    expect(browser.listeners()).toBeGreaterThan(0)
    expect(browser.pendingFrames()).toBe(1)
    browser.coordinator.dispose()
    expect(browser.listeners()).toBe(0)
    expect(browser.pendingFrames()).toBe(0)
    expect(browser.disconnected()).toBe(browser.observers())
    browser.emit("wheel", { deltaY: 10 })
    expect(browser.pendingFrames()).toBe(0)
    expect(browser.coordinator.navigate("first")).toBe(false)
    const nextPage = browserFixture()
    expect(nextPage.current()).toBe("first")
    nextPage.coordinator.dispose()
  })
})
