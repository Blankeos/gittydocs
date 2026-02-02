# gittydocs (ejected)

This is built on top of the Solid Launch template:
https://github.com/blankeos/solid-launch

Gittydocs is essentially a repackaged docs template. So you could use it without the template. If you're reading this, you're using the ejected version for more granular customizations.

### Structure (high level)

**Gittydocs stuff**

- `docs/` – your content (follows https://gittydocs.carlo.tl) linked via env `GITTYDOCS_SOURCE`
- `src/gittydocs/` – gittydocs code (components, contexts, hooks, lib, styles)
- `src/pages/(docs)/` – Vike routes for documentation pages at `/*`
- `scripts/gen-velite-routes.ts` and `scripts/prepare-docs.ts` - Scripts that are used to build your docs

**Regular vike stuff**

- `src/pages/` – Vike pages
- Shared code from the template stays put

If you are ejecting or customizing, start in `src/gittydocs/` and keep the Vike files in place.
