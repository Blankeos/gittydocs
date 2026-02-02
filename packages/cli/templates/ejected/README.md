# gittydocs (ejected)

This is the fully-customizable Gittydocs app.

## Requirements

- bun (https://bun.sh)

## Local docs

Your docs live in `./docs` by default.

The app reads the docs source from `GITTYDOCS_SOURCE` (see `.env.example`).

## Commands

```bash
bun install
bun run dev
```

Build a static site:

```bash
bun run build
```

## Customize

Start in `src/gittydocs/` for Gittydocs-specific code.
