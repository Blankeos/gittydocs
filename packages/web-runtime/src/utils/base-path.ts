export function withBasePath(routePath: string) {
  const base = normalizeBase(import.meta.env.BASE_URL)
  if (base === "/") return routePath
  if (routePath.startsWith(base)) return routePath
  const normalizedRoute = routePath.startsWith("/") ? routePath : `/${routePath}`
  return `${base.replace(/\/$/, "")}${normalizedRoute}`
}

export function stripBasePath(pathname: string) {
  const base = normalizeBase(import.meta.env.BASE_URL)
  if (base === "/") return pathname
  if (pathname.startsWith(base)) {
    const stripped = pathname.slice(base.length - 1)
    return stripped.startsWith("/") ? stripped : `/${stripped}`
  }
  return pathname
}

function normalizeBase(base: string | undefined) {
  if (!base) return "/"
  return base.endsWith("/") ? base : `${base}/`
}
