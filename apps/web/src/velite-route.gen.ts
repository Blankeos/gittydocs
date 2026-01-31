export const veliteRoutes = [
  "/",
  "/configuration",
  "/structure"
] as const

export type VeliteRoute = typeof veliteRoutes[number]
