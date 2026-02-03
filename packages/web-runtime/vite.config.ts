import path from "node:path"
import vikeRoutegen from "@blankeos/vike-routegen"
import tailwindcss from "@tailwindcss/vite"
import vike from "vike/plugin"
import vikeSolid from "vike-solid/vite"
import { defineConfig, type Plugin } from "vite"
import solidSvg from "vite-plugin-solid-svg"
import tsConfigPaths from "vite-tsconfig-paths"

const hotReloadRoots = [
  ".velite",
  "content",
  "public/static",
  "public/llms",
  "public/llms.txt",
  "src/gittydocs/lib/docs",
  "src/gittydocs/lib/themes",
]

function gittydocsHotReload(): Plugin {
  return {
    name: "gittydocs-hot-reload",
    configureServer(server) {
      const root = server.config.root || process.cwd()
      const watchRoots = hotReloadRoots.map((target) => path.resolve(root, target))

      for (const watchRoot of watchRoots) {
        server.watcher.add(watchRoot)
      }

      let reloadTimer: ReturnType<typeof setTimeout> | undefined
      const scheduleReload = () => {
        if (reloadTimer) return
        reloadTimer = setTimeout(() => {
          reloadTimer = undefined
          server.ws.send({ type: "full-reload" })
        }, 150)
      }

      const shouldReload = (file: string) =>
        watchRoots.some((rootPath) => isWithinPath(file, rootPath))

      const onFsEvent = (file: string) => {
        if (shouldReload(file)) scheduleReload()
      }

      server.watcher.on("add", onFsEvent)
      server.watcher.on("change", onFsEvent)
      server.watcher.on("unlink", onFsEvent)
      server.watcher.on("addDir", onFsEvent)
      server.watcher.on("unlinkDir", onFsEvent)
    },
  }
}

function isWithinPath(filePath: string, rootPath: string) {
  if (filePath === rootPath) return true
  const relative = path.relative(rootPath, filePath)
  return !!relative && !relative.startsWith("..") && !path.isAbsolute(relative)
}

export default defineConfig({
  plugins: [
    tsConfigPaths(),
    gittydocsHotReload(),
    vike({}),
    vikeSolid(),
    vikeRoutegen(),
    solidSvg(),
    tailwindcss(),
  ],
  server: {
    port: 3000,
  },
  preview: { port: 3000 },
  envPrefix: ["PUBLIC_"],
})
