export const veliteRoutes = [
  "/",
  "/configuration",
  "/deploy/cloudflare",
  "/deploy/github-pages",
  "/deploy/netlify",
  "/deploy/vercel",
  "/motivation"
] as const

export type VeliteRoute = typeof veliteRoutes[number]
