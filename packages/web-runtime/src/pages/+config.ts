import type { Config } from "vike/types"
import config from "vike-solid/config"
import { privateEnv } from "@/env.private"

export default {
  extends: config,
  port: privateEnv.PORT,
  prerender: true,
} satisfies Config
