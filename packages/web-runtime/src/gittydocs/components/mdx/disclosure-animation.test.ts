import { describe, expect, test } from "bun:test"
import { disclosureAnimationPlan, supportsNativeDisclosureAnimation } from "./disclosure-animation"

const plan = (from: number, to: number, fullHeight = 200, remaining?: number) =>
  disclosureAnimationPlan({ from, to, fullHeight, remaining, reducedMotion: false })

describe("native disclosure progressive enhancement", () => {
  const features = [
    "selector(::details-content)",
    "(interpolate-size: allow-keywords)",
    "(transition-behavior: allow-discrete)",
  ]

  test("requires all three features, not just the content pseudo", () => {
    expect(supportsNativeDisclosureAnimation((condition) => features.includes(condition))).toBe(
      true
    )
    for (const missing of features) {
      expect(supportsNativeDisclosureAnimation((condition) => condition !== missing)).toBe(false)
    }
  })
})

describe("disclosure height animation decisions", () => {
  test("opening and closing use the same timing and easing", () => {
    expect(plan(0, 200)).toEqual({
      from: 0,
      to: 200,
      duration: 220,
      easing: "cubic-bezier(0.2, 0, 0, 1)",
    })
    expect(plan(200, 0)).toEqual({
      from: 200,
      to: 0,
      duration: 220,
      easing: "cubic-bezier(0.2, 0, 0, 1)",
    })
  })

  test("rapid reversals start at the current height and scale to remaining distance", () => {
    expect(plan(50, 0)?.duration).toBe(55)
    expect(plan(50, 200)?.duration).toBe(165)
    expect(plan(75, 0)?.from).toBe(75)
    expect(plan(75, 200)?.from).toBe(75)
    // Independent closing items cannot affect one another's decisions.
    expect(plan(150, 0)?.duration).toBe(165)
    expect(plan(50, 0)?.duration).toBe(55)
  })

  test("resizing an opening ancestor keeps its deadline instead of restarting each frame", () => {
    expect(plan(60, 250, 250, 80)?.duration).toBe(80)
    expect(plan(90, 275, 275, 64)?.duration).toBe(64)
    expect(plan(150, 300, 300, 0)).toBeNull()
    expect(plan(150, 300, 300, -10)).toBeNull()
  })

  test("closing an ancestor has a stable zero endpoint even if its content changes", () => {
    expect(plan(150, 0, 300)?.to).toBe(0)
    expect(plan(125, 0, 50)?.duration).toBe(220)
  })

  test("reduced motion settles immediately in either direction", () => {
    for (const [from, to] of [
      [0, 200],
      [200, 0],
      [60, 200],
    ]) {
      expect(disclosureAnimationPlan({ from, to, fullHeight: 200, reducedMotion: true })).toBeNull()
    }
  })

  test("empty, subpixel, or unavailable measurements never start an animation", () => {
    expect(plan(0, 0, 0)).toBeNull()
    expect(plan(100, 100.25)).toBeNull()
    expect(plan(Number.NaN, 200)).toBeNull()
    expect(plan(0, Number.POSITIVE_INFINITY)).toBeNull()
    expect(plan(0, 200, Number.NaN)).toBeNull()
  })
})
