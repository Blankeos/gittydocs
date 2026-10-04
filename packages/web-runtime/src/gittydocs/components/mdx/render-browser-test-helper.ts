import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import { createServer, type ViteDevServer } from "vite"
import solid from "vite-plugin-solid"
import solidSvg from "vite-plugin-solid-svg"

export const browserExecutable = Bun.which("agent-browser")
export const runtimeRoot = path.resolve(import.meta.dir, "../../../..")

/** Each harness owns its Vite server, temporary files and browser (never human CDP). */
export function renderBrowserHarness(name: string) {
  const session = `${name}-${process.pid}`
  let server: ViteDevServer | undefined
  let directory: string | undefined
  async function command(...args: string[]) {
    if (!browserExecutable) throw new Error("agent-browser is required")
    const child = Bun.spawn([browserExecutable, "--session", session, "--json", ...args], {
      stdout: "pipe",
      stderr: "pipe",
    })
    const [stdout, stderr, status] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    if (status !== 0) throw new Error(`agent-browser ${args[0]}: ${stderr || stdout}`)
    const response = JSON.parse(stdout)
    if (!response.success) throw new Error(response.error)
    return response.data
  }
  return {
    command,
    async evaluate(code: string) {
      return (await command("eval", code)).result
    },
    async start(fixture: string, stubs: Record<string, string>, options: { ssr?: boolean } = {}) {
      directory = await mkdtemp(path.join(tmpdir(), `${name}-`))
      await symlink(path.join(runtimeRoot, "node_modules"), path.join(directory, "node_modules"))
      const stubPaths = new Map<string, string>()
      for (const [id, source] of Object.entries(stubs)) {
        const file = path.join(directory, `stub-${stubPaths.size}.tsx`)
        stubPaths.set(id, file)
        await writeFile(file, source)
      }
      await writeFile(path.join(directory, "fixture.tsx"), fixture)
      if (options.ssr) {
        await writeFile(
          path.join(directory, "server.tsx"),
          `import { renderToString } from "solid-js/web"
          import { Fixture } from "./fixture"
          export function render() { return renderToString(() => <Fixture />) }`
        )
      }
      await writeFile(
        path.join(directory, "client.tsx"),
        `
        import { render } from "solid-js/web"
        import { Fixture } from "./fixture"
        import ${JSON.stringify(path.join(runtimeRoot, "src/styles/app.css"))}
        import ${JSON.stringify(path.join(runtimeRoot, "src/gittydocs/styles/prose.css"))}
        import ${JSON.stringify(path.join(runtimeRoot, "src/gittydocs/styles/mdx-components.css"))}
        render(() => <Fixture />, document.getElementById("app"))
        window.fixtureReady = true
      `
      )
      let ssrHtml = ""
      server = await createServer({
        configFile: false,
        root: runtimeRoot,
        cacheDir: path.join(directory, "cache"),
        plugins: [
          {
            name: "render-test-fixture",
            enforce: "pre",
            resolveId(id) {
              const relative = path.relative(path.join(runtimeRoot, "src"), id)
              const alias = `@/${relative.replace(/\.tsx?$/, "")}`
              return stubPaths.get(id) ?? stubPaths.get(alias)
            },
            configureServer(vite) {
              vite.middlewares.use((request, response, next) => {
                if (request.url === "/render-test") {
                  response.setHeader("Content-Type", "text/html; charset=utf-8")
                  response.end(
                    options.ssr
                      ? `<!doctype html><html><head>${[
                          "src/styles/app.css",
                          "src/gittydocs/styles/prose.css",
                          "src/gittydocs/styles/mdx-components.css",
                        ]
                          .map((file) => `<link rel="stylesheet" href="/${file}?direct">`)
                          .join("")}</head><body><div id="app">${ssrHtml}</div></body></html>`
                      : `<!doctype html><html><body><div id="app"></div><script type="module" src="/@fs/${directory}/client.tsx"></script></body></html>`
                  )
                } else next()
              })
            },
          },
          solid({ hot: false, ssr: options.ssr ?? false }),
          solidSvg(),
          tailwindcss(),
        ],
        resolve: { alias: { "@": path.join(runtimeRoot, "src") } },
        ssr: { resolve: { conditions: ["node"], externalConditions: ["node"] } },
        server: { host: "127.0.0.1", port: 0, fs: { allow: [runtimeRoot, directory] } },
        optimizeDeps: {
          noDiscovery: true,
          include: ["solid-js", "solid-js/web", "solid-js/store"],
        },
      })
      await server.listen()
      if (options.ssr) {
        const fixtureModule = await server.ssrLoadModule(path.join(directory, "server.tsx"))
        ssrHtml = fixtureModule.render()
      }
      const address = server.httpServer!.address()
      if (!address || typeof address === "string") throw new Error("Missing fixture port")
      await command("set", "viewport", "1200", "1000")
      await command("open", `http://127.0.0.1:${address.port}/render-test`)
      // This document contains no scripts: mounting/hydration must never repair SSR visibility.
      if (options.ssr) return
      for (let attempt = 0; attempt < 60; attempt++) {
        if (await this.evaluate("window.fixtureReady === true")) return
        const errors = (await command("errors")).errors
        if (errors.length) throw new Error(`Fixture failed: ${JSON.stringify(errors)}`)
        await Bun.sleep(250)
      }
      throw new Error("Fixture did not mount within 15 seconds")
    },
    async close() {
      try {
        if (browserExecutable) await command("close")
      } finally {
        await server?.close()
        if (directory) await rm(directory, { recursive: true, force: true })
      }
    },
  }
}
