import { onCleanup, onMount } from "solid-js"

const copyIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" class="animate-scaleIn"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M7 9.667A2.667 2.667 0 0 1 9.667 7h8.666A2.667 2.667 0 0 1 21 9.667v8.666A2.667 2.667 0 0 1 18.333 21H9.667A2.667 2.667 0 0 1 7 18.333z"/><path d="M4.012 16.737A2 2 0 0 1 3 15V5c0-1.1.9-2 2-2h10c.75 0 1.158.385 1.5 1"/></g></svg>'
const checkIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" class="animate-scaleIn"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 6L9 17l-5-5"/></svg>'

const selector = "pre"

function normalizeCode(pre: HTMLPreElement) {
  const code = pre.querySelector("code")?.textContent ?? pre.textContent ?? ""
  return code.replace(/\n+$/, "")
}

async function copyText(text: string) {
  if (!text.trim()) return false
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return true
  }

  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "true")
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.select()
  const success = document.execCommand("copy")
  textarea.remove()
  return success
}

function enhancePre(pre: HTMLPreElement) {
  if (pre.dataset.copyReady === "true") return
  pre.dataset.copyReady = "true"

  if (pre.parentElement?.classList.contains("code-block")) return

  const wrapper = document.createElement("div")
  wrapper.className = "code-block"

  const parent = pre.parentNode
  if (!parent) return
  parent.insertBefore(wrapper, pre)
  wrapper.appendChild(pre)

  const button = document.createElement("button")
  button.type = "button"
  button.className = "code-block-copy"
  button.setAttribute("aria-label", "Copy code")
  button.setAttribute("title", "Copy code")
  button.innerHTML = copyIcon

  let resetTimer: number | undefined

  button.addEventListener("click", async () => {
    const text = normalizeCode(pre)
    const success = await copyText(text)
    if (!success) return

    button.dataset.copied = "true"
    button.setAttribute("aria-label", "Copied")
    button.setAttribute("title", "Copied")
    button.innerHTML = checkIcon

    if (resetTimer) window.clearTimeout(resetTimer)
    resetTimer = window.setTimeout(() => {
      button.dataset.copied = "false"
      button.setAttribute("aria-label", "Copy code")
      button.setAttribute("title", "Copy code")
      button.innerHTML = copyIcon
    }, 1600)
  })

  wrapper.appendChild(button)
}

function scanAndEnhance(root: ParentNode) {
  root.querySelectorAll<HTMLPreElement>(selector).forEach((pre) => {
    enhancePre(pre)
  })
}

export function CodeBlockCopy() {
  onMount(() => {
    scanAndEnhance(document)

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue
          if (node.matches(selector)) {
            enhancePre(node as HTMLPreElement)
            continue
          }
          if (node.querySelector) scanAndEnhance(node)
        }
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })

    onCleanup(() => observer.disconnect())
  })

  return null
}
