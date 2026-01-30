# PRD: gittydocs

Turn a GitHub folder of Markdown/MDX into a fast, searchable docs site with almost no setup.

## Product Direction

gittydocs should feel like:

- Viewer-first: a docs *reader* that mirrors a repo's content cleanly.
- Minimal/low-maintenance: no heavy authoring framework; no bespoke build pipeline required.
- Fast by default: instant navigation + instant search on typical docs sizes.

Long-term, gittydocs should support a near-zero-config GitHub Pages deployment path via a single workflow file.

## Modes

### 1) Public Viewer (no auth)

- Input: a public GitHub repo/folder URL.
- Output: a shareable permalink URL that renders that docs tree.

### 2) Self-Hosted (env-config)

- Input: env vars for `owner/repo/ref/docsPath`.
- Output: a docs site pinned to that source.

### 3) GitHub Pages (future: near-zero config deploy)

- Add a single workflow file to deploy to GitHub Pages.
- gittydocs builds a static docs site from the repo contents (no runtime GitHub fetching).
- Optional: add a config file later for explicit nav/branding.

## Goals

- Convert a GitHub docs folder into a usable docs site quickly.
- Keep setup friction close to zero (especially for GitHub Pages deploy).
- Make search feel instant and keyboard-first.
- Make content maintenance native to GitHub (edit links, issues links, permalinks).
- Support deep links to headings and a reliable "On this page" ToC.

## Non-Goals (Intentionally Out of Scope)

- Full CMS, approvals, or team workflow automation.
- Versioning UI, locales, or multi-site management.
- Complex theming system.
- "Docs components zoo" (admonitions/tabs/etc. beyond simple MDX).
- A required server-side search service for MVP.

## Primary Users

### Docs reader (public)

- Wants to view docs from a repo without cloning/building.

### Repo owner/maintainer

- Wants docs to look good with minimal configuration.
- Wants search, ToC, permalinks, and GitHub-native edit flow.

### Team that wants zero-config deploy

- Wants a docs site deployed from the repo with one workflow file.

## Information Architecture

### Source Files

- Supported content: `*.mdx` (MVP), with optional `.md` support as a likely early extension.
- Conventional landing file (preferred): `index.mdx` or `index.md`.
- README fallback: `README.mdx|README.md` can act as index when no `index.*` exists.

### Frontmatter (optional)

- `title`: string
- `description`: string
- `date`: string (ISO recommended)
- `categories`: string | string[]

Title resolution order: `frontmatter.title` -> first H1 -> filename.

## Configuration Philosophy

Configuration should be *optional*.

Precedence order (highest to lowest):

1. Explicit runtime inputs (env vars for self-host; URL params for viewer).
2. `gittydocs.jsonc` or `gittydocs.json` if present.
3. Auto-discovery + heuristics (docs root, nav, titles).

This allows a "works without config" path, while still supporting explicit nav control.

## Configuration File (Draft)

File: `gittydocs.jsonc` (preferred) or `gittydocs.json`.

```jsonc
{
  "site": {
    "name": "My Docs",
    "logo": "optional text or url",
    "repo": {
      "owner": "org",
      "name": "repo",
      "ref": "main",
      "docsPath": "docs" // folder containing gittydocs.jsonc (optional in viewer)
    }
  },
  "nav": [
    {
      "label": "Getting Started",
      "items": [
        { "label": "Introduction", "path": "/" },
        { "label": "Install", "path": "/install" }
      ]
    }
  ],
  "links": {
    "issues": "https://github.com/org/repo/issues"
  }
}
```

Notes:

- `path` is the docs route (not the GitHub path).
- JSONC enables comments/trailing commas; JSON is fallback.

## Auto-Discovery (No Config)

Auto-discovery should be conservative and predictable.

### Docs Root Detection

Try in order:

1. Folder containing `gittydocs.jsonc|json`.
2. Conventional folders containing `index.*` or `README.*`: `docs/`, `doc/`, `documentation/`.
3. Repo root if it contains `index.*` or `README.*`.

If multiple candidates match, pick the shortest path (closest to repo root) and expose a UI affordance to switch roots (viewer mode), but keep the URL permalink stable.

### Nav Generation

When no config is present:

- Use a tree listing to find pages under docs root.
- Sort by:
  1) `index.*` first within a folder,
  2) numeric prefixes (`01-foo.mdx`),
  3) alphabetical.
- Generate routes from relative paths.
- Labels from title resolution (frontmatter/H1/filename).

## Core Features (MVP)

### Routing + Rendering

- URL routes map cleanly to the source tree.
- Support:
  - page routes
  - heading anchors (e.g. `#installation`)
  - deep linking to any supported file

### Navigation

- Left sidebar:
  - config-driven when config exists
  - auto-generated when no config
  - indicates active page

### "On this page"

- Right-side ToC:
  - generated from headings in current page
  - scroll spy highlights current section
  - smooth scroll + correct focus/URL hash

### Search (Ctrl+K)

- Hotkeys: `Ctrl+K` / `Cmd+K`.
- Engine: `flexsearch`.
- Behavior:
  - modal/palette
  - title + snippet results
  - keyboard navigation (up/down/enter/esc)
  - optional anchor deep-linking when best match is a heading

### Footer Links

- "Edit this page" -> exact GitHub file at configured ref.
- "Open an issue" -> issues URL (configurable; optional prefill).

## GitHub Integration

### Inputs

- Viewer: `owner`, `repo`, `ref`, and `docsPath` inferred from the URL (or discovered).
- Self-host: `owner`, `repo`, `ref`, `docsPath` via env.

### Fetch Strategy (MVP)

- Fetch config if present.
- Fetch MD/MDX files on demand per route.
- Cache:
  - honor ETag/Last-Modified
  - use edge/browser caching where possible

Search indexing:

- Start simple: index only pages in nav (config nav or auto nav).
- Optionally prefetch/index in background after first render.

### Permalink Format (Viewer)

Stable URL scheme (draft):

- `/gh/:owner/:repo/:ref/*docsPath` as the docs root
- routes beneath map to doc routes

Examples:

- `/gh/solidjs/solid/main/docs` -> loads docs root
- `/gh/solidjs/solid/main/docs/install` -> loads `docs/install.mdx` (or `.md`)

## Data Model

Represent each page as:

- `routePath` (e.g. `/getting-started/installation`)
- `sourcePath` (path relative to docs root)
- `title`
- `description`
- `headings` (for ToC + search anchors)
- `content` (compiled MDX)

## Search Indexing Details

Index fields:

- `title`
- `description`
- `headings` (H2/H3 weighted lower)
- `bodyText` (MDX stripped to text)

Result fields:

- `routePath`
- `anchor` (optional)
- `snippet`

Storage:

- in-memory per active docs root
- optional `indexedDB` cache keyed by `owner/repo/ref/docsPath`

## Product Requirements

### Performance

- Search typing stays responsive (target: < 50ms/keystroke on typical docs corpora).
- Avoid heavy client bundles; split per-page MDX when possible.
- Avoid repeated GitHub fetches; use caching aggressively.

### UX + Aesthetic

- Minimal, low-noise UI.
- Strong typographic hierarchy for docs.
- Mobile:
  - sidebar in a drawer
  - ToC collapses or moves below header

### Accessibility

- Keyboard-first navigation and search.
- Modal focus management.
- Proper heading semantics; anchor focus visibility.

## GitHub Pages Mode (Future: Near-Zero Config Deploy)

This mode exists to:

- Make the "minimal config" path a single committed workflow file.
- Avoid runtime GitHub API/rate limits by building from the checked out repo.
- Improve performance by shipping a static site (prebuilt nav + prebuilt search index).

### Setup UX

- User adds `.github/workflows/gittydocs.yml`.
- Default behavior requires no other repo changes.
- Optional customization:
  - add `gittydocs.jsonc` for explicit nav/branding
  - set workflow inputs/env for `docsPath` if auto-detection is wrong

### Build + Deploy Behavior

- On push to default branch:
  - checkout repo
  - detect docs root (config-first, else heuristics)
  - build static HTML for pages
  - build a static search index artifact
  - deploy to GitHub Pages

Target: GitHub project pages (served under `/<repo>/`). The build must support a configurable base path.

Optional (later): PR preview deploys.

### Security

- Uses GitHub Actions' built-in token to deploy Pages.
- No content fetching from GitHub at runtime.

## Tech Stack (Current)

- UI: SolidJS
- Routing + SSR-ish meta: Vike
- Components: shadcn
- Hotkey: bagon-hooks
- Search: flexsearch

## Architecture (High-Level)

- App shell: header + sidebar + content + ToC + footer
- Data layer:
  - source resolver (viewer/env/pages)
  - GitHub fetch module (raw URLs / API + caching)
  - config parser (JSONC/JSON)
  - MDX loader/compiler
  - search index builder
  - scroll spy (IntersectionObserver)

## Milestones

### MVP (Public Viewer + Self-Hosted)

1. Resolve docs root (env or viewer route) and load config if present.
2. Render MDX per route with frontmatter + heading anchors.
3. Sidebar (config-driven, with fallback auto-nav if no config).
4. ToC + scroll spy.
5. Ctrl/Cmd+K search indexing nav pages.
6. GitHub footer links.
7. Document Cloudflare-friendly deploy.

### V1.1 (No-Config Quality)

- Robust docs root detection.
- Solid auto-nav ordering rules.
- `.md` support (if not already done).

### V1.2 (GitHub Pages Workflow)

- Provide an official `.github/workflows/gittydocs.yml`.
- Static build that works with no config via auto-discovery.
- GitHub Pages deploy docs.

## Acceptance Criteria

MVP:

- Given a docs root, renders `index.*` (or README fallback) at `/`.
- Sidebar matches config order when config exists; otherwise shows deterministic auto-nav.
- ToC highlights while scrolling.
- `Ctrl/Cmd+K` opens search; results update as user types; enter navigates.
- "Edit this page" resolves the correct GitHub file at the configured ref.
- Mobile navigation and search are usable.

GitHub Pages (when implemented):

- Adding the workflow file results in a deployed Pages site that renders docs.
- Site has working nav, ToC, and search without requiring `gittydocs.jsonc`.
- Pages works when hosted under a repo subpath (project pages base path).

## Risks / Constraints

- GitHub API/rate limits (viewer mode) and raw content restrictions.
- MDX compilation cost (cache aggressively; consider precompilation later).
- Search indexing size for large docs sets (incremental indexing/limits).
- JSONC parsing in-browser (keep parser small and safe).

## Open Questions

- `.md` support timing (MVP vs V1.1)?
- How do we expose "switch docs root" in viewer mode without making permalinks confusing?
- GitHub Enterprise support (custom domains)?
- Best caching layer for viewer mode (edge caching strategy)?
- Should we ship one workflow or two (Node vs Bun), and what runtime do we officially support?
- How do we handle custom base paths cleanly for GitHub Pages (repo pages vs user/org pages)?
- Do we require pre-rendered routes for Pages, or do we ship a SPA fallback (`404.html`) to support client-side routing?
