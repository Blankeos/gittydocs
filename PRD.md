# PRD: gittydocs

Turn a GitHub folder of Markdown/MDX into a fast, searchable docs site with almost no setup.

## Product Direction

gittydocs should feel like:

- Build-time first: a static docs site generated at build time, not a public viewer.
- Minimal/low-maintenance: no heavy authoring framework; keep setup close to zero.
- Fast by default: instant navigation + instant search on typical docs sizes.
- Frontend polish: use the layout and MDX rendering approach from `/Users/carlo/Desktop/Projects/email-thing/apps/landing` as the baseline for the docs UI.

gittydocs should support a near-zero-config GitHub Pages deployment path via a single workflow file.

## Modes

### 1) Build-Time Static (primary)

- Input: a single env var that points to either a public GitHub URL or a local path.
- Output: a static docs site pinned to that source.

### 2) Local Scaffold (secondary)

- Input: `bunx degit` a template folder and keep the same docs structure.
- Output: a local docs site you can customize freely.

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

### Docs reader (static site)

- Wants to view docs without cloning/building.

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

Configuration should be *optional* and build-time focused.

Precedence order (highest to lowest):

1. Single build-time env var `GITTYDOCS_SOURCE` (GitHub URL or local path).
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
      "docsPath": "docs" // folder containing gittydocs.jsonc (optional)
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

If multiple candidates match, pick the shortest path (closest to repo root) and allow override via config or `GITTYDOCS_SOURCE`.

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

- `GITTYDOCS_SOURCE` env var:
  - Public GitHub URL pointing to a repo or folder, e.g. `https://github.com/org/repo/tree/main/docs`.
  - Local path, e.g. `./docs` or `/absolute/path/to/docs`.

`docs` is the default folder name, but the env var can point to any path.

### Fetch Strategy (MVP)

- Build-time only.
- If `GITTYDOCS_SOURCE` is GitHub URL:
  - parse URL and use the `api.github.com/repos` endpoint to resolve the tree.
  - fetch MD/MDX content during the build and emit a static site.
- If `GITTYDOCS_SOURCE` is a local path:
  - read from disk during the build.

Search indexing:

- Build-time index from the same source and ship a static index artifact.

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

- in-memory after loading the static index artifact

## Product Requirements

### Performance

- Search typing stays responsive (target: < 50ms/keystroke on typical docs corpora).
- Avoid heavy client bundles; split per-page MDX when possible.
- Avoid repeated source reads during the build; use caching aggressively.

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

## GitHub Pages Mode (Near-Zero Config Deploy)

This mode exists to:

- Make the "minimal config" path a single committed workflow file.
- Avoid runtime GitHub API/rate limits by building from the checked out repo.
- Improve performance by shipping a static site (prebuilt nav + prebuilt search index).

### Setup UX

- User adds `.github/workflows/gittydocs.yml`.
- Default behavior requires no other repo changes.
- Optional customization:
  - add `gittydocs.jsonc` for explicit nav/branding
  - set `GITTYDOCS_SOURCE` if auto-detection is wrong or a non-default docs folder is used

### Build + Deploy Behavior

- On push to default branch:
  - checkout repo
  - resolve docs source (`GITTYDOCS_SOURCE` or auto-discovery)
  - build static HTML for pages
  - build a static search index artifact
  - deploy to GitHub Pages

Target: GitHub project pages (served under `/<repo>/`). The build must support a configurable base path.

### Workflow Template (Short)

```yaml
name: gittydocs
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run build
        env:
          GITTYDOCS_SOURCE: ./docs
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

### Cloudflare Pages (Optional)

- Use the same build command and output `./dist`.
- Set `GITTYDOCS_SOURCE` in the project environment variables.

## Tech Stack (Current)

- UI: SolidJS
- Routing + SSR-ish meta: Vike
- MDX: Velite (use the implementation pattern from `/Users/carlo/Desktop/Projects/email-thing/apps/landing`)
- Components: shadcn
- Hotkey: bagon-hooks
- Search: flexsearch

## Architecture (High-Level)

- App shell: header + sidebar + content + ToC + footer
- Data layer:
  - source resolver (`GITTYDOCS_SOURCE` -> GitHub URL or local path)
  - GitHub fetch module (API + raw content during build)
  - config parser (JSONC/JSON)
  - Velite MDX loader/compiler
  - search index builder (build-time)
  - scroll spy (IntersectionObserver)

## Milestones

### MVP (Build-Time Static)

1. Resolve docs root from `GITTYDOCS_SOURCE` and load config if present.
2. Render MDX per route with Velite (frontmatter + heading anchors).
3. Sidebar (config-driven, with fallback auto-nav if no config).
4. ToC + scroll spy.
5. Ctrl/Cmd+K search indexing nav pages.
6. GitHub footer links.
7. Provide a short GitHub Pages workflow and a Cloudflare Pages deploy note.

### V1.1 (No-Config Quality)

- Robust docs root detection.
- Solid auto-nav ordering rules.
- `.md` support (if not already done).

### V1.1 (GitHub Pages Workflow)

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
- No public viewer UI; site is preconfigured at build time.

GitHub Pages:

- Adding the workflow file results in a deployed Pages site that renders docs.
- Site has working nav, ToC, and search without requiring `gittydocs.jsonc`.
- Pages works when hosted under a repo subpath (project pages base path).

## Risks / Constraints

- GitHub API/rate limits when building from a public GitHub URL.
- MDX compilation cost (cache aggressively; consider precompilation later).
- Search indexing size for large docs sets (incremental indexing/limits).
- JSONC parsing in-browser (keep parser small and safe).

## Open Questions

- `.md` support timing (MVP vs V1.1)?
- GitHub Enterprise support (custom domains)?
- Should we ship one workflow or two (Node vs Bun), and what runtime do we officially support?
- How do we handle custom base paths cleanly for GitHub Pages (repo pages vs user/org pages)?
- Do we require pre-rendered routes for Pages, or do we ship a SPA fallback (`404.html`) to support client-side routing?
