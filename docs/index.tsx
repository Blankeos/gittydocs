import { createSignal, onCleanup, onMount } from "solid-js"
import { withBasePath } from "@/utils/base-path"
import {
  IconArrowRight,
  IconBot,
  IconFileText,
  IconGitHub,
  IconPackageOpen,
  IconRocket,
  IconSearch,
  IconTerminal,
} from "./_components/icons"

export const sidebar = false
export const toc = false
export const title = "gittydocs"
export const description =
  "Zero-config docs from MDX and gittydocs.jsonc — searchable, AI-ready, static deploy. No app code required."

const CLI_COMMAND = "npx gittydocs@latest new docs"

export default function Page() {
  const [copied, setCopied] = createSignal(false)
  const [ready, setReady] = createSignal(false)
  let copyReset: ReturnType<typeof setTimeout> | undefined

  onMount(() => {
    const id = requestAnimationFrame(() => setReady(true))
    onCleanup(() => {
      cancelAnimationFrame(id)
      if (copyReset) clearTimeout(copyReset)
    })
  })

  const copyCli = async () => {
    try {
      await navigator.clipboard.writeText(CLI_COMMAND)
      setCopied(true)
      if (copyReset) clearTimeout(copyReset)
      copyReset = setTimeout(() => setCopied(false), 1600)
    } catch {
      // ignore
    }
  }

  return (
    <div class="gd-landing" classList={{ "gd-landing--ready": ready() }}>
      <style>{landingCss}</style>

      <section class="gd-hero">
        <div class="gd-hero__glow" aria-hidden="true" />

        <div class="gd-hero__content">
          <p class="gd-pill">
            <span class="gd-pill__dot" aria-hidden="true" />
            v0.0.5
          </p>

          <h1 class="gd-title">
            Zero-config docs.
            <span class="gd-title__soft"> MDX and JSON—no app code.</span>
          </h1>

          <p class="gd-subtitle">
            Drop <code>.mdx</code> pages and a <code>gittydocs.jsonc</code> in a folder. Get search,
            themes, <code>/llms.txt</code>, and static deploy. Use the CLI to scaffold—skip
            JavaScript until you want to customize or eject.
          </p>

          <div class="gd-actions">
            <a class="gd-btn gd-btn--primary" href={withBasePath("/introduction")}>
              Read the docs
              <IconArrowRight class="gd-icon gd-icon--btn" />
            </a>
            <a
              class="gd-btn gd-btn--secondary"
              href="https://github.com/blankeos/gittydocs"
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconGitHub class="gd-icon gd-icon--btn" />
              GitHub
            </a>
          </div>

          <button
            type="button"
            class="gd-terminal"
            onClick={copyCli}
            aria-label="Copy install command"
          >
            <IconTerminal class="gd-icon gd-icon--terminal" />
            <code class="gd-terminal__code">{CLI_COMMAND}</code>
            <span class="gd-terminal__hint">{copied() ? "Copied" : "Click to copy"}</span>
          </button>
        </div>
      </section>

      <section class="gd-block">
        <header class="gd-block__head gd-block__head--center">
          <h2>Write. Push. Ship.</h2>
          <p>Content and config only—no doc app to build unless you choose to.</p>
        </header>

        <ul class="gd-cards gd-cards--3">
          <li class="gd-card">
            <span class="gd-card__icon" aria-hidden="true">
              <IconFileText class="gd-icon" />
            </span>
            <h3>MDX + JSON</h3>
            <p>
              Pages in <code>.mdx</code>, site settings in <code>gittydocs.jsonc</code>—no React app
              to author.
            </p>
          </li>
          <li class="gd-card">
            <span class="gd-card__icon" aria-hidden="true">
              <IconGitHub class="gd-icon" />
            </span>
            <h3>Push to GitHub</h3>
            <p>Your repo is the source of truth. “Edit this page” links back to it.</p>
          </li>
          <li class="gd-card">
            <span class="gd-card__icon" aria-hidden="true">
              <IconRocket class="gd-icon" />
            </span>
            <h3>Deploy static</h3>
            <p>GitHub Pages, Vercel, Cloudflare, Netlify — same export everywhere.</p>
          </li>
        </ul>
      </section>

      <section class="gd-block gd-block--muted">
        <header class="gd-block__head gd-block__head--center">
          <h2>Defaults, not a checklist</h2>
          <p>Search, ToC, dark mode, and agent exports—on without flipping feature flags.</p>
        </header>

        <ul class="gd-cards gd-cards--3">
          <li class="gd-card gd-card--flat">
            <span class="gd-card__icon gd-card__icon--sm" aria-hidden="true">
              <IconBot class="gd-icon" />
            </span>
            <h3>AI-ready</h3>
            <p>
              Build-time <code>/llms.txt</code> so agents can skim your docs without parsing HTML.
            </p>
          </li>
          <li class="gd-card gd-card--flat">
            <span class="gd-card__icon gd-card__icon--sm" aria-hidden="true">
              <IconSearch class="gd-icon" />
            </span>
            <h3>Search &amp; ToC</h3>
            <p>
              <kbd>⌘ K</kbd> search and scroll-spy headings — no config switch to flip.
            </p>
          </li>
          <li class="gd-card gd-card--flat">
            <span class="gd-card__icon gd-card__icon--sm" aria-hidden="true">
              <IconPackageOpen class="gd-icon" />
            </span>
            <h3>Ejectable</h3>
            <p>Velite + Vike + Solid under the hood. Stay packaged or own the template.</p>
          </li>
        </ul>
      </section>

      <section class="gd-block gd-cta-block">
        <h2>Five minutes to a live preview</h2>
        <p>Introduction, CLI, and deploy guides—then theme it or eject the stack.</p>
        <div class="gd-actions gd-actions--center">
          <a class="gd-btn gd-btn--primary" href={withBasePath("/introduction")}>
            Open Introduction
            <IconArrowRight class="gd-icon gd-icon--btn" />
          </a>
          <a class="gd-btn gd-btn--secondary" href={withBasePath("/cli")}>
            CLI reference
          </a>
        </div>
      </section>
    </div>
  )
}

const landingCss = `
.gd-landing {
  width: 100%;
  color: var(--foreground);
  background: var(--background);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

.gd-landing code {
  font-family: var(--font-mono);
  font-size: 0.9em;
  padding: 0.12em 0.35em;
  border-radius: 0.35rem;
  background: color-mix(in oklch, var(--muted) 80%, transparent);
}

.gd-landing kbd {
  font-family: var(--font-mono);
  font-size: 0.85em;
  padding: 0.15em 0.45em;
  border-radius: 0.35rem;
  border: 1px solid var(--border);
  background: var(--background);
}

.gd-icon {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
}

.gd-icon--btn {
  width: 1rem;
  height: 1rem;
  opacity: 0.9;
}

.gd-icon--terminal {
  width: 1.1rem;
  height: 1.1rem;
  color: var(--muted-foreground);
}

.gd-hero {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: min(88vh, 52rem);
  padding: clamp(3rem, 8vw, 5rem) clamp(1.25rem, 4vw, 2rem);
  text-align: center;
  overflow: hidden;
}

.gd-hero__glow {
  position: absolute;
  inset: -20% 0 auto;
  height: 70%;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 70% 50% at 50% 0%, color-mix(in oklch, var(--primary) 18%, transparent), transparent 65%),
    radial-gradient(ellipse 40% 30% at 80% 20%, color-mix(in oklch, var(--accent) 35%, transparent), transparent 55%);
  opacity: 0.9;
}

.gd-hero__content {
  position: relative;
  z-index: 1;
  width: min(42rem, 100%);
  margin: 0 auto;
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 0.55s ease, transform 0.55s ease;
}

.gd-landing--ready .gd-hero__content {
  opacity: 1;
  transform: none;
}

.gd-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 1.25rem;
  padding: 0.35rem 0.85rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: color-mix(in oklch, var(--background) 70%, var(--muted));
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--muted-foreground);
}

.gd-pill__dot {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background: var(--primary);
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--primary) 25%, transparent);
}

.gd-title {
  margin: 0;
  font-size: clamp(2.125rem, 5.5vw, 3.25rem);
  font-weight: 650;
  letter-spacing: -0.035em;
  line-height: 1.08;
  text-wrap: balance;
}

.gd-title__soft {
  display: block;
  font-weight: 550;
  color: var(--muted-foreground);
}

@media (min-width: 640px) {
  .gd-title__soft {
    display: inline;
  }
}

.gd-subtitle {
  margin: 1.25rem auto 0;
  max-width: 36rem;
  font-size: clamp(1rem, 2.2vw, 1.125rem);
  line-height: 1.65;
  color: var(--muted-foreground);
  text-wrap: balance;
}

.gd-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 2rem;
}

.gd-actions--center {
  justify-content: center;
}

.gd-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 2.625rem;
  padding: 0 1.125rem;
  border-radius: 0.5rem;
  font-size: 0.9375rem;
  font-weight: 500;
  text-decoration: none;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}

.gd-btn:active {
  transform: scale(0.98);
}

.gd-btn--primary {
  background: var(--primary);
  color: oklch(1 0 0);
}

.gd-btn--primary:hover {
  filter: brightness(1.05);
}

.gd-btn--secondary {
  border: 1px solid var(--border);
  background: var(--background);
  color: var(--foreground);
}

.gd-btn--secondary:hover {
  background: var(--muted);
}

.gd-terminal {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  width: min(100%, 28rem);
  margin: 1.5rem auto 0;
  padding: 0.65rem 0.85rem;
  border: 1px solid var(--border);
  border-radius: 0.625rem;
  background: color-mix(in oklch, var(--muted) 40%, var(--background));
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.gd-terminal:hover {
  border-color: color-mix(in oklch, var(--primary) 35%, var(--border));
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--primary) 12%, transparent);
}

.gd-terminal__code {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.8125rem;
  background: none;
  padding: 0;
}

.gd-terminal__hint {
  flex-shrink: 0;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted-foreground);
}

.gd-block {
  padding: clamp(3.5rem, 8vw, 5.5rem) clamp(1.25rem, 4vw, 2rem);
  border-top: 1px solid var(--border);
}

.gd-block--muted {
  background: color-mix(in oklch, var(--muted) 35%, var(--background));
}

.gd-block__head {
  max-width: 40rem;
  margin: 0 auto 2.5rem;
}

.gd-block__head--center {
  text-align: center;
}

.gd-block__head h2 {
  margin: 0;
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: 600;
  letter-spacing: -0.03em;
}

.gd-block__head p {
  margin: 0.65rem 0 0;
  color: var(--muted-foreground);
  font-size: 1rem;
  line-height: 1.55;
}

.gd-cards {
  list-style: none;
  margin: 0 auto;
  padding: 0;
  max-width: 56rem;
  display: grid;
  gap: 1rem;
}

@media (min-width: 768px) {
  .gd-cards--3 {
    grid-template-columns: repeat(3, 1fr);
    gap: 1.25rem;
  }
}

.gd-card {
  padding: 1.35rem 1.25rem;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--card-foreground);
}

.gd-card--flat {
  background: var(--background);
}

.gd-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  margin-bottom: 1rem;
  border-radius: 0.5rem;
  background: color-mix(in oklch, var(--primary) 12%, var(--muted));
  color: var(--primary);
}

.gd-card__icon--sm {
  width: 2.25rem;
  height: 2.25rem;
}

.gd-card__icon .gd-icon {
  width: 1.15rem;
  height: 1.15rem;
}

.gd-card h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.gd-card p {
  margin: 0.5rem 0 0;
  font-size: 0.9375rem;
  line-height: 1.55;
  color: var(--muted-foreground);
}

.gd-cta-block {
  text-align: center;
  padding-bottom: clamp(4rem, 10vw, 6rem);
}

.gd-cta-block h2 {
  margin: 0;
  font-size: clamp(1.375rem, 3vw, 1.75rem);
  font-weight: 600;
  letter-spacing: -0.03em;
}

.gd-cta-block p {
  margin: 0.65rem auto 0;
  max-width: 28rem;
  color: var(--muted-foreground);
}

.gd-cta-block .gd-actions {
  margin-top: 1.75rem;
}

@media (prefers-reduced-motion: reduce) {
  .gd-hero__content,
  .gd-btn {
    transition: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
}
`
