import path from "node:path"
import { pathExists } from "./fs"

export async function findGittydocsConfigPath(docsDir: string) {
  for (const fileName of ["gittydocs.jsonc", "gittydocs.json"]) {
    const p = path.join(docsDir, fileName)
    if (await pathExists(p)) return p
  }
  return null
}
