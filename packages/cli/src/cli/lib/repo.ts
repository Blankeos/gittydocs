import fs from "node:fs"
import path from "node:path"

export function getRepoRootFromCwd() {
  return findRepoRoot(process.cwd())
}

function findRepoRoot(startDir: string) {
  let dir = path.resolve(startDir)
  for (let i = 0; i < 25; i++) {
    const gitDir = path.join(dir, ".git")
    if (fs.existsSync(gitDir)) return dir

    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return path.resolve(startDir)
}
