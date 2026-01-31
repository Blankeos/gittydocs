import tailwindcss from "@tailwindcss/vite"
import vike from "vike/plugin"
import vikeSolid from "vike-solid/vite"
import vikeRoutegen from "@blankeos/vike-routegen"
import { defineConfig } from "vite"
import solidSvg from "vite-plugin-solid-svg"
import tsConfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [
    tsConfigPaths(),
    vike({
      prerender: {
        partial: true,
      },
    }),
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
