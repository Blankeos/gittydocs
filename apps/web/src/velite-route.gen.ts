export const veliteRoutes = [
  "/",
  "/README",
  "/configuration",
  "/getting-started",
  "/guides/quickstart",
  "/structure"
] as const

export type VeliteRoute = typeof veliteRoutes[number]
