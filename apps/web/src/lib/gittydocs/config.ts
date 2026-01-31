import { parse } from "jsonc-parser"
import type { DocsConfig, GitHubRepo, NavItem } from "./types"

export function parseConfig(jsonContent: string): DocsConfig | null {
  try {
    const parsed = parse(jsonContent)
    if (!parsed || typeof parsed !== "object") return null
    return parsed as DocsConfig
  } catch {
    return null
  }
}

export function createDefaultConfig(repo: GitHubRepo): DocsConfig {
  return {
    site: {
      name: `${repo.owner}/${repo.repo}`,
      repo,
    },
  }
}

export function resolveNavItems(config: DocsConfig | null, autoNav: NavItem[]): NavItem[] {
  if (config?.nav && config.nav.length > 0) {
    return config.nav
  }
  return autoNav
}
