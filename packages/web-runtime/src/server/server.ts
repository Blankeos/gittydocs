import vike from "@vikejs/hono"
import { Hono } from "hono"
import type { Server } from "vike/types"
import { privateEnv } from "@/env.private"

const app = new Hono()

app.get("/up", async (c) => {
  return c.newResponse("🟢 UP", { status: 200 })
})

vike(app)

export default {
  fetch: app.fetch,
  prod: {
    port: privateEnv.PORT,
  },
} satisfies Server
