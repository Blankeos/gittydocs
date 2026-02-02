# gittydocs (ejected)

This is built on top of the Solid Launch template:
https://github.com/blankeos/solid-launch

gittydocs keeps Vike routing intact in `src/pages/` (including the `(docs)` routes) and collocates gittydocs-specific modules under `src/gittydocs/`.

Structure (high level)

- `src/gittydocs/` – gittydocs code (components, contexts, hooks, lib, styles)
- `docs/` – your content (follows https://gittydocs.carlo.tl)
- `src/pages/` – Vike pages
- Shared code from the template stays put

If you are ejecting or customizing, start in `src/gittydocs/` and keep the Vike files in place.
