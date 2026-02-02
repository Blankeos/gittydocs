# Collocation Refactor Plan

Goal
- Reduce scattered gittydocs-only files while keeping Vike page structure intact.
- Do not relocate Vike routing files like `src/pages/+config.ts`, `src/pages/+Page.tsx`, `src/pages/+Layout.tsx`, or route groups such as `src/pages/(docs)/...`.

Recommended layout (default)
- Keep the app root intact under `apps/web`, and collocate only gittydocs-specific modules into dedicated subfolders within `src/`.
- Leave Vike pages under `src/pages/` as-is.

High-level approach
1. Identify gittydocs-specific modules and move them into a single `src/gittydocs/` area.
2. Keep shared or app-agnostic pieces (e.g. `theme.context.tsx`) where they are.
3. Update imports to the new locations without changing Vike page layout.
4. Update docs to describe the new structure for ejecting and customization.

Step-by-step plan
1) Define the gittydocs-only zone in `src/`
- Create `src/gittydocs/` with clear subfolders:
  - `src/gittydocs/components/` (from `components/docs`)
  - `src/gittydocs/contexts/` (from `contexts/docs.context.tsx`, `contexts/search.context.tsx`)
  - `src/gittydocs/hooks/` (from `hooks/use-flex-search.ts`)
  - `src/gittydocs/lib/` (from `lib/docs`, `lib/themes`, `lib/velite`)
  - `src/gittydocs/styles/` (from `styles/themes`, `styles/prose.css`)

2) Keep shared/non-gittydocs pieces in place
- `src/contexts/theme.context.tsx` stays where it is.
- Vike pages remain in `src/pages/**` and keep `(docs)/` routes intact.

3) Update imports
- Update all imports pointing to moved files.
- Prefer a single alias (e.g. `~/gittydocs/...`) to reduce future churn.

4) Update docs
- Update eject/customization guidance to reference `src/gittydocs/...`.
- Note which files remain in `src/pages/` due to Vike.

5) Verify
- Run typecheck/lint if desired.
- Ensure no missing imports and no Vike routing regressions.

Notes and risks
- Vike requires the `src/pages` structure; do not move those files.
- Keep generated artifacts in their current locations unless they are explicitly gittydocs-only and safe to relocate.
- Update any absolute/aliased import paths to avoid circular dependencies.

Definition of done
- All gittydocs-specific logic lives under `src/gittydocs/`.
- Vike routing files remain under `src/pages/` (including `(docs)/`).
- Docs explain the new split clearly for ejecting/customization.
