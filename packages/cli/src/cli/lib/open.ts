import { spawn } from "node:child_process"

export async function openUrl(url: string) {
  const platform = process.platform
  if (platform === "darwin") {
    spawn("open", [url], { stdio: "ignore", detached: true })
    return
  }
  if (platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true })
    return
  }
  spawn("xdg-open", [url], { stdio: "ignore", detached: true })
}
