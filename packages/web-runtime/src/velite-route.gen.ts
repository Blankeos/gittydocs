export const veliteRoutes = [
  "/",
  "/ai-docs-prompt",
  "/cli",
  "/components",
  "/components/accordion",
  "/components/code-blocks",
  "/components/files",
  "/components/steps",
  "/configuration",
  "/deploy",
  "/deploy/cloudflare",
  "/deploy/github-pages",
  "/deploy/netlify",
  "/deploy/vercel",
  "/introduction",
  "/motivation",
  "/navigation",
  "/theming"
] as const

export type VeliteRoute = typeof veliteRoutes[number]
