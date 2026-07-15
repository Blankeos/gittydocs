export const veliteRoutes = [
  "/",
  "/ai-docs-prompt",
  "/cli",
  "/configuration",
  "/deploy",
  "/deploy/cloudflare",
  "/deploy/github-pages",
  "/deploy/netlify",
  "/deploy/vercel",
  "/introduction",
  "/motivation",
  "/theming"
] as const

export type VeliteRoute = typeof veliteRoutes[number]
