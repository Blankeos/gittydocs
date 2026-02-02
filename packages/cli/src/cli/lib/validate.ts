import fs from "node:fs/promises"

export async function isDirectory(p: string) {
  try {
    const stat = await fs.stat(p)
    return stat.isDirectory()
  } catch {
    return false
  }
}
