export const veliteRoutes = [
  "/",
  "/ai-docs-prompt",
  "/cli",
  "/configuration",
  "/deploy/cloudflare",
  "/deploy/github-pages",
  "/deploy/netlify",
  "/deploy/vercel",
  "/motivation",
  "/theming",
] as const

export type VeliteRoute = (typeof veliteRoutes)[number]
