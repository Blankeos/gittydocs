const duration = 220
const easing = "cubic-bezier(0.2, 0, 0, 1)"

/** Pure timing decision, shared by reversals and content-resize retargets. */
export function disclosureAnimationPlan({
  from,
  to,
  fullHeight,
  reducedMotion,
  remaining,
}: {
  from: number
  to: number
  fullHeight: number
  reducedMotion: boolean
  remaining?: number
}) {
  if (
    reducedMotion ||
    !Number.isFinite(from + to + fullHeight) ||
    Math.abs(to - from) < 0.5 ||
    (remaining !== undefined && remaining <= 0)
  ) {
    return null
  }

  return {
    from: Math.max(0, from),
    to: Math.max(0, to),
    // A reversal should only take as long as the distance still to travel.
    duration: remaining ?? duration * Math.min(1, Math.abs(to - from) / Math.max(1, fullHeight)),
    easing,
  }
}

/** Keep this feature query identical to the CSS progressive-enhancement query. */
export function supportsNativeDisclosureAnimation(supports: (condition: string) => boolean) {
  return (
    supports("selector(::details-content)") &&
    supports("(interpolate-size: allow-keywords)") &&
    supports("(transition-behavior: allow-discrete)")
  )
}

/**
 * Native open/name/summary activation always owns the logical state. In browsers
 * without intrinsic-size interpolation, animate a measured wrapper instead.
 * Temporarily exposing ::details-content lets a *closed* details finish shrinking
 * without restoring open (which would steal a native exclusive group's state).
 * Bodies stay mounted and return to native hiding/searchability at rest.
 *
 * https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/::details-content
 * https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/interpolate-size
 */
export function animateDisclosure(details: HTMLDetailsElement, content: HTMLDivElement) {
  const supports = (condition: string) => CSS.supports(condition)
  if (
    supportsNativeDisclosureAnimation(supports) ||
    !supports("selector(::details-content)") ||
    typeof content.animate !== "function"
  ) {
    // Older engines without the content pseudo keep fully functional native
    // disclosures. Never fake open or replace the native summary with a button.
    return () => {}
  }

  const body = content.firstElementChild as HTMLElement | null
  if (!body) return () => {}

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
  const initialHeight = content.style.height
  const initialInert = content.inert
  let open = details.open
  let animation: Animation | undefined
  let targetHeight = 0
  let finishAt = 0
  let disposed = false

  details.setAttribute("data-mdx-disclosure-fallback", "")

  const cancel = () => {
    const previous = animation
    animation = undefined
    if (previous) {
      previous.onfinish = null
      previous.oncancel = null
      previous.cancel()
    }
  }

  const settle = () => {
    cancel()
    content.style.height = initialHeight
    content.inert = initialInert
    details.removeAttribute("data-mdx-disclosure-animating")
  }

  const run = (from: number, to: number, fullHeight: number, remaining?: number) => {
    const plan = disclosureAnimationPlan({
      from,
      to,
      fullHeight,
      reducedMotion: motion.matches,
      remaining,
    })
    // Pin the sampled presentation before canceling a previous animation, so a
    // reversal/resize never briefly falls back to the full natural height.
    content.style.height = `${from}px`
    cancel()
    targetHeight = to
    if (!plan) {
      settle()
      return
    }

    if (remaining === undefined) finishAt = performance.now() + plan.duration
    const current = content.animate([{ height: `${plan.from}px` }, { height: `${plan.to}px` }], {
      duration: plan.duration,
      easing: plan.easing,
      fill: "both",
    })
    animation = current
    current.onfinish = () => {
      if (animation !== current || disposed) return
      // A native change may precede its MutationObserver/toggle notification.
      if (details.open !== open) sync()
      else settle()
    }
    current.oncancel = () => {
      if (animation === current && !disposed) settle()
    }
  }

  const sync = () => {
    if (disposed || details.open === open) return
    const wasOpen = open
    open = details.open
    // MutationObserver runs before paint, unlike the coalesced native toggle
    // task. Reveal the closing content before measuring, without changing open.
    details.setAttribute("data-mdx-disclosure-animating", "")
    const from = animation || wasOpen ? content.getBoundingClientRect().height : 0
    const fullHeight = body.getBoundingClientRect().height
    if (!open && content.contains(details.ownerDocument.activeElement)) {
      details.querySelector("summary")?.focus({ preventScroll: true })
    }
    content.inert = initialInert || !open
    run(from, open ? fullHeight : 0, fullHeight)
  }

  const mutations = new MutationObserver(sync)
  mutations.observe(details, { attributes: true, attributeFilter: ["open"] })
  // toggle also covers browser-driven expansion; sync is idempotent and never
  // writes open, so native name exclusivity and rapid coalesced events are safe.
  details.addEventListener("toggle", sync)

  const resizes = new ResizeObserver(() => {
    if (!animation || !open || disposed) return
    const fullHeight = body.getBoundingClientRect().height
    if (Math.abs(fullHeight - targetHeight) < 0.5) return
    // Keep the original deadline, especially when a nested disclosure changes
    // size every frame. Closing always retains its fixed zero-height endpoint.
    run(
      content.getBoundingClientRect().height,
      fullHeight,
      fullHeight,
      finishAt - performance.now()
    )
  })
  resizes.observe(body)

  const motionChanged = () => {
    if (motion.matches) {
      open = details.open
      settle()
    }
  }
  motion.addEventListener("change", motionChanged)

  return () => {
    disposed = true
    mutations.disconnect()
    resizes.disconnect()
    details.removeEventListener("toggle", sync)
    motion.removeEventListener("change", motionChanged)
    settle()
    details.removeAttribute("data-mdx-disclosure-fallback")
  }
}
