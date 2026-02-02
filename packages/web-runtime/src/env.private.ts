import { createEnv } from "@t3-oss/env-core"
import z from "zod"

export const privateEnv = createEnv({
  runtimeEnv: process.env,
  server: {
    /** Development|Prod. Port of the app. */
    PORT: z.number().default(3000),
    /** Development|Prod. */
    NODE_ENV: z.enum(["development", "production"]).default("development"),

    // GitHub API (for server-side fetching)
    GITHUB_TOKEN: z.string().optional(),
  },
})
