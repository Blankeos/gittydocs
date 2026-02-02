import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["packages/cli/src/cli/index.ts"],
  format: ["esm"],
  target: "node18",
  platform: "node",
  sourcemap: true,
  clean: true,
  dts: false,
  splitting: false,
  bundle: true,
  minify: false,
  outDir: "dist",
  banner: {
    js: "#!/usr/bin/env node",
  },
  esbuildOptions(options) {
    options.entryNames = "cli"
  },
})
