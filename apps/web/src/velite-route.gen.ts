export const veliteRoutes = [
  "/",
  "/configuration",
  "/getting-started",
  "/structure"
] as const

export type VeliteRoute = typeof veliteRoutes[number]
