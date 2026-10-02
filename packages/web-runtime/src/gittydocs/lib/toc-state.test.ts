import { describe, expect, test } from "bun:test"
import {
  createTocState,
  getScrollActiveSlug,
  isScrollKey,
  reduceTocState,
  slugFromHash,
} from "./toc-state"

const slugs = ["first", "middle", "last"]

describe("ToC state", () => {
  test("initializes from a valid decoded hash, including an unreachable last heading", () => {
    expect(createTocState(slugs, "#last")).toEqual({
      slugs,
      activeSlug: "last",
      pinnedSlug: "last",
    })
    expect(createTocState(["a b"], "#a%20b").pinnedSlug).toBe("a b")
    expect(createTocState(slugs, "#missing").activeSlug).toBe("first")
    expect(slugFromHash("#%invalid")).toBeNull()
    expect(createTocState([]).activeSlug).toBeNull()
  })

  test("selection is immediate and every programmatic scroll remains pinned", () => {
    let state = reduceTocState(createTocState(slugs), { type: "select", slug: "last" })
    expect(state.activeSlug).toBe("last")
    for (let index = 0; index < 500; index++) {
      state = reduceTocState(state, { type: "scroll", slug: "middle" })
    }
    expect(state.activeSlug).toBe("last")
    state = reduceTocState(state, { type: "select", slug: "middle" })
    expect(state.activeSlug).toBe("middle")
    expect(state.pinnedSlug).toBe("middle")
  })

  test("only intent unpins; a subsequent scroll resumes normal tracking", () => {
    let state = createTocState(slugs, "#last")
    state = reduceTocState(state, { type: "intent" })
    expect(state.activeSlug).toBe("last")
    expect(state.pinnedSlug).toBeNull()
    state = reduceTocState(state, { type: "scroll", slug: "middle" })
    expect(state.activeSlug).toBe("middle")
    expect(reduceTocState(state, { type: "scroll", slug: "missing" })).toBe(state)
    expect(reduceTocState(state, { type: "select", slug: "missing" })).toBe(state)
  })

  test("a page reset removes the old pin even when slugs overlap", () => {
    const state = reduceTocState(createTocState(slugs, "#last"), { type: "reset", slugs })
    expect(state.pinnedSlug).toBeNull()
    expect(state.activeSlug).toBe("first")
    const next = reduceTocState(state, { type: "reset", slugs: ["new"], hash: "#new" })
    expect(next.activeSlug).toBe("new")
    expect(createTocState(slugs).pinnedSlug).toBeNull()
  })
})

describe("normal scroll tracking", () => {
  test("uses the preceding heading in gaps and supports jumps in either direction", () => {
    expect(
      getScrollActiveSlug(
        [
          { slug: "first", top: 300 },
          { slug: "middle", top: 1000 },
        ],
        92
      )
    ).toBe("first")
    expect(
      getScrollActiveSlug(
        [
          { slug: "first", top: -500 },
          { slug: "middle", top: 500 },
        ],
        92
      )
    ).toBe("first")
    expect(
      getScrollActiveSlug(
        [
          { slug: "first", top: -900 },
          { slug: "middle", top: 90 },
        ],
        92
      )
    ).toBe("middle")
    expect(
      getScrollActiveSlug(
        [
          { slug: "first", top: -500 },
          { slug: "last", top: 400 },
        ],
        92,
        true
      )
    ).toBe("last")
    expect(getScrollActiveSlug([], 92)).toBeNull()
  })

  test("does not mistake ordinary typing, controls, or shortcuts for scroll intent", () => {
    for (const key of ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]) {
      expect(isScrollKey({ key })).toBe(true)
      expect(isScrollKey({ key, editable: true })).toBe(false)
      expect(isScrollKey({ key, defaultPrevented: true })).toBe(false)
      expect(isScrollKey({ key, ctrlKey: true })).toBe(false)
      expect(isScrollKey({ key, metaKey: true })).toBe(false)
      expect(isScrollKey({ key, altKey: true })).toBe(false)
    }
    for (const key of ["a", "Enter", "Tab", "Escape", "Shift"])
      expect(isScrollKey({ key })).toBe(false)
  })
})
