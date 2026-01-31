import { gittydocsSource } from "@/lib/docs/source.gen"
import type { DocsConfig } from "@/lib/gittydocs/types"

export function getRepoUrl(config: DocsConfig | null) {
  if (config?.site?.repo) {
    return `https://github.com/${config.site.repo.owner}/${config.site.repo.repo}`
  }
  if (gittydocsSource.type === "github" && gittydocsSource.repo) {
    return `https://github.com/${gittydocsSource.repo.owner}/${gittydocsSource.repo.repo}`
  }
  return null
}

export function getEditUrl(sourcePath: string) {
  if (gittydocsSource.type !== "github" || !gittydocsSource.repo) return null
  const { owner, repo, ref, docsPath } = gittydocsSource.repo
  const prefix = docsPath ? `${docsPath}/` : ""
  return `https://github.com/${owner}/${repo}/edit/${ref}/${prefix}${sourcePath}`
}

export function getIssuesUrl(config: DocsConfig | null) {
  if (config?.links?.issues) return config.links.issues
  if (gittydocsSource.type === "github" && gittydocsSource.repo) {
    return `https://github.com/${gittydocsSource.repo.owner}/${gittydocsSource.repo.repo}/issues`
  }
  return null
}

export function getSiteName(config: DocsConfig | null) {
  if (config?.site?.name) return config.site.name
  if (gittydocsSource.type === "github" && gittydocsSource.repo) {
    return `${gittydocsSource.repo.owner}/${gittydocsSource.repo.repo}`
  }
  return "gittydocs"
}
