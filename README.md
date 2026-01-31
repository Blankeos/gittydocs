# gittydocs

Turn a GitHub folder of Markdown/MDX into a fast, searchable docs site.

## Quick Start

Create a `docs` folder in your repo with these files:

```bash
mkdir -p docs/guides && cat > docs/gittydocs.jsonc << 'EOF'
{
  "site": {
    "name": "My Project",
    "repo": {
      "owner": "yourusername",
      "name": "yourrepo",
      "ref": "main",
      "docsPath": "docs"
    }
  }
}
EOF

cat > docs/index.mdx << 'EOF'
---
title: Welcome
description: Getting started with my project
---

# Welcome

This is your documentation homepage.
EOF

cat > docs/guides/quickstart.mdx << 'EOF'
---
title: Quick Start
description: Get up and running in minutes
---

# Quick Start

Here's how to use this thing.
EOF
```

Push to a public GitHub repo, then deploy:

### GitHub Pages

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bunx degit blankeos/gittydocs/template ./temp && mv ./temp/* . && rm -rf ./temp
      - run: bun install
      - run: GITTYDOCS_SOURCE="https://github.com/${{ github.repository }}/tree/${{ github.ref_name }}/docs" bun run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist/client
      - uses: actions/deploy-pages@v4
        id: deployment
```

Enable GitHub Pages in repo settings → Pages → Source: GitHub Actions.

### Vercel

```bash
# One-time setup
bunx degit blankeos/gittydocs/template my-docs
cd my-docs
bun install

# Set environment variable in Vercel dashboard:
# GITTYDOCS_SOURCE=https://github.com/yourusername/yourrepo/tree/main/docs

# Build settings (already configured):
# Build Command: bun run build
# Output Directory: dist/client
```

### Cloudflare Pages

Connect your repo with these settings:
- **Build command:** `bun run build`
- **Build output:** `dist/client`
- **Environment variable:** `GITTYDOCS_SOURCE=https://github.com/yourusername/yourrepo/tree/main/docs`

### Netlify

Connect your repo with these settings:
- **Build command:** `bun run build`
- **Publish directory:** `dist/client`
- **Environment variable:** `GITTYDOCS_SOURCE=https://github.com/yourusername/yourrepo/tree/main/docs`

Done. Your docs are live.

---

## Customize Everything

Want full control? The template is just a thin wrapper around [Velite](https://velite.js.org/).

```bash
# Get the full source
bunx degit blankeos/gittydocs/apps/web my-custom-docs
cd my-custom-docs
bun install
```

Edit `velite.config.ts`, components, styles—it's all yours. Deploy the same way.

## Features

- **Search** — Instant full-text search with `Ctrl+K`
- **Auto Navigation** — Sidebar generated from your file structure
- **Dark Mode** — Built-in toggle
- **GitHub Integration** — "Edit this page" links
- **Static Export** — Deploy anywhere

## License

MIT
