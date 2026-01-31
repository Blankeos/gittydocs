import { veliteRoutes } from "@/velite-route.gen"

export function onBeforePrerenderStart() {
  return veliteRoutes.filter((route) => route !== "/")
}
