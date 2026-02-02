import fs from "node:fs/promises"
import path from "node:path"

export async function pathExists(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true })
}

export async function rmDir(dirPath: string) {
  await fs.rm(dirPath, { recursive: true, force: true })
}

export async function isDirEmpty(dirPath: string) {
  const entries = await fs.readdir(dirPath)
  return entries.length === 0
}

export async function readFileText(filePath: string) {
  return fs.readFile(filePath, "utf-8")
}

export async function writeFileText(filePath: string, content: string) {
  await ensureDir(path.dirname(filePath))
  await fs.writeFile(filePath, content, "utf-8")
}

export async function copyDir(
  srcDir: string,
  destDir: string,
  options?: {
    ignoreNames?: Set<string>
    ignoreRelPathPrefixes?: string[]
  }
) {
  await copyDirInternal({
    baseSrcDir: srcDir,
    srcDir,
    destDir,
    options: {
      ignoreNames: options?.ignoreNames,
      ignoreRelPathPrefixes: (options?.ignoreRelPathPrefixes ?? []).map(normalizeRel),
    },
  })
}

async function copyDirInternal(input: {
  baseSrcDir: string
  srcDir: string
  destDir: string
  options: {
    ignoreNames?: Set<string>
    ignoreRelPathPrefixes: string[]
  }
}) {
  const entries = await fs.readdir(input.srcDir, { withFileTypes: true })
  await ensureDir(input.destDir)

  for (const entry of entries) {
    const src = path.join(input.srcDir, entry.name)
    const dest = path.join(input.destDir, entry.name)

    if (input.options.ignoreNames?.has(entry.name)) continue

    const relPosix = normalizeRel(path.relative(input.baseSrcDir, src))
    if (shouldIgnoreRelPath(relPosix, input.options.ignoreRelPathPrefixes)) continue

    if (entry.isDirectory()) {
      await copyDirInternal({
        ...input,
        srcDir: src,
        destDir: dest,
      })
      continue
    }

    if (entry.isFile()) {
      await ensureDir(path.dirname(dest))
      await fs.copyFile(src, dest)
    }
  }
}

function shouldIgnoreRelPath(relPosix: string, prefixes: string[]) {
  for (const prefix of prefixes) {
    if (relPosix === prefix) return true
    if (prefix && relPosix.startsWith(`${prefix}/`)) return true
  }
  return false
}

function normalizeRel(value: string) {
  return value.replace(/\\/g, "/").replace(/^\/+/, "")
}
