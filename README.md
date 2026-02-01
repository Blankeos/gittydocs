# gittydocs ✨

Simple, but ejectable modern docs for simple devs.

Turn a GitHub folder of Markdown/MDX into a fast, searchable docs site.

**[Documentation →](https://gittydocs.carlo.tl)**

## Quick Start

```bash
mkdir docs && cat > docs/gittydocs.jsonc << 'EOF'
{
  "site": {
    "name": "My Project",
    "logo": "/logo.svg",
    "repo": {
      "owner": "yourusername",
      "name": "yourrepo",
      "ref": "main",
      "docsPath": "docs"
    }
  },
  "links": {
    "github": "https://github.com/yourusername/yourrepo",
    "issues": "https://github.com/yourusername/yourrepo/issues"
  }
}
EOF
```

Push to GitHub. Deploy with an action.

See [gittydocs.carlo.tl](https://gittydocs.carlo.tl) for full setup and deployment guides.

## Features

- **Quick & Easy** — One config file, push to GitHub, deploy anywhere
- **Full-Text Search** — `Ctrl+K` for instant search across all docs
- **Table of Contents** — Auto-generated with scroll spy showing current section
- **Copy Page** — Copy entire page as Markdown with one click
- **Dark Mode** — Built-in toggle
- **GitHub Integration** — "Edit this page" links
- **Fully Customizable** — Built on Velite + Vike + Solid. Eject anytime and own your stack
- **Static Export** — Deploy to any host

## License

MIT

Built w/ 🩷 using Vike + Solid
