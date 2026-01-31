import tailwindcss from "@tailwindcss/vite"
import vike from "vike/plugin"
import vikeSolid from "vike-solid/vite"
import { defineConfig } from "vite"
import solidSvg from "vite-plugin-solid-svg"
import tsConfigPaths from "vite-tsconfig-paths"

const basePath = process.env.PUBLIC_BASE_PATH || "/"

export default defineConfig({
  base: basePath,
  plugins: [
    tsConfigPaths(),
    vike({
      prerender: {
        partial: true,
      },
    }),
    vikeSolid(),
    solidSvg(),
    tailwindcss(),
  ],
  server: {
    port: 3000,
  },
  preview: { port: 3000 },
  envPrefix: ["PUBLIC_"],
})
