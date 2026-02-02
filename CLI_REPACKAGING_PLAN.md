# CLI Repackaging Plan

## Goal
Ship a `gittydocs` CLI that packages the existing app into a developer-friendly local workflow and provides scaffold + deploy helpers.

## Non-Goals (for v1)
- No hosted SaaS or remote build service
- No new UI features in the docs app
- No multi-repo orchestration

## Target CLI Surface

### `gittydocs dev <GITTYDOCS_SOURCE>`
Local dev environment that abstracts away app/web for quick testing.

Behavior:
- Accepts a path or repo reference as `<GITTYDOCS_SOURCE>`
- If no env is explicitly provided, auto-detect `.env` in `<GITTYDOCS_SOURCE>` and load it
- Starts the dev server with hot reload
- Prints the local URL and key config paths

Flags (initial):
- `--env <path>`: explicit env file
- `--port <number>`: dev server port override
- `--open`: open browser

### `gittydocs new <folder>`
Scaffolds a new Gittydocs setup in the current directory.

Modes:
- `--default` (default): create `<folder>` with standard structure, including `gittydocs.jsonc`, starter `index.mdx`, and minimal assets
- `--ejected`: create `<folder>`, then place a full app/web template (bunx degit of the current `apps/web`), and `cd` into it

Notes:
- `--default` should keep a minimal dependency footprint (no full app copy)
- `--ejected` should document how to run the app directly

### `gittydocs deploy`
Creates `.github/workflows/deploy-gittydocs.yml` for a selected platform.

Flags:
- `--cfpages`
- `--ghpages`
- `--vercel`
- `--netlify`

Behavior:
- Errors if multiple providers are selected
- Writes a provider-specific workflow with sensible defaults
- Detects `docs/` or a custom `docsPath` from `gittydocs.jsonc`

### `gittydocs build`
Local build command that uses the bundled app/web.

Behavior:
- Runs `bun run build` under the hood
- Uses the local template/app, not a cloned repo
- Accepts the same `<GITTYDOCS_SOURCE>` semantics as `dev` (optional)

Flags (initial):
- `--env <path>`: explicit env file
- `--out <path>`: build output override if supported by the app

## Packaging Strategy

### Binary + NPM
- Publish `gittydocs` as an npm package with a single entrypoint
- Bundle the CLI with a build step (e.g. `tsup`) to minimize runtime dependencies
- Keep templates under `templates/` inside the package
- Add the CLI as a lightweight, separate package (e.g. `packages/cli` or `apps/cli`) without changing the repo to a full monorepo setup
  High-level structure:
  - `apps/web/`
  - `packages/cli/` (new)
  - `docs/`
  - `templates/`

### Runtime Requirements
- Node 18+ (or align with app requirements)
- Bun only required for `--ejected` or advanced workflows if the template uses it

## CLI Architecture

### Entrypoint
- `src/cli/index.ts` as the single entrypoint
- Use `cac` as the command router
- Use `@clack/prompts` for wizard-style prompts when flags are missing

### Command Modules
- `src/cli/commands/dev.ts`
- `src/cli/commands/build.ts`
- `src/cli/commands/new.ts`
- `src/cli/commands/deploy.ts`

### Shared Utilities
- Config discovery (find `gittydocs.jsonc`)
- Env loading
- Template copying
- Workflow writer

## Templates & Assets

### Default Template
- `templates/default/`
  - `docs/gittydocs.jsonc`
  - `docs/index.mdx`
  - `docs/README.md` (optional)

### Ejected Template
- `templates/ejected/` generated from `apps/web` (or degit it at runtime)
- Keep instructions in `templates/ejected/README.md`

## Dev Command Execution

### Source Resolution
1. If `<GITTYDOCS_SOURCE>` is a path, resolve to absolute path
2. If it is a Git URL, clone to a temp dir
3. If it is omitted, default to `.`

### Env Handling
- If `--env` provided, load it
- Else, load `<source>/.env` if present

### Server Start
- Run the local dev server from `apps/web` with the source mounted
- Provide hot reload by watching `docs/` and config files

## Deploy Workflows

### Generation
- `.github/workflows/deploy-gittydocs.yml`
- Provider-specific defaults for build + publish
- Workflow should call `gittydocs build` instead of cloning/building a separate app
- Include docs path and output path detection

### Validation
- Ensure `gittydocs.jsonc` exists
- Ensure `.github/workflows/` exists or create it

## User Experience Details

- Clear error messages with next steps
- Fast exits on missing input or invalid flags
- Print a short “what next” section after `new` and `deploy`
- Keep prompts optional: only prompt when required inputs/flags are missing

## Milestones

1. CLI skeleton + help output
2. `new --default` scaffold
3. `new --ejected` scaffold
4. `dev` local runner
5. `deploy` workflow generation
6. Docs updates in `docs/` to reflect CLI usage

Note: We'll align the docs after the implementation is complete.

## Open Questions

- Should `dev` support remote GitHub repo shorthand like `owner/name`? (No; only public repo links and local folders as in current official docs.)
- Should `new --default` include a sample sidebar/nav file? (Yes; keep it simple in `gittydocs.jsonc`.)
- Should `deploy` support multiple workflows in one repo? (Yes; allow multiple providers e.g. `gittydocs deploy --cfpages --ghpages`, and consider separate workflow files per provider by default.)
