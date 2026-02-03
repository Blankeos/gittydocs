import { z } from "zod"

export const gitHubRepoSchema = z
  .object({
    owner: z.string().describe("GitHub username or org"),
    name: z.string().describe("Repository name"),
    ref: z.string().optional().describe("Branch or tag"),
    docsPath: z.string().optional().describe("Path to docs folder"),
  })
  .describe("GitHub repository metadata")

export type GitHubRepo = z.output<typeof gitHubRepoSchema>

export type NavItem = {
  label: string
  path?: string
  items?: NavItem[]
  accordion?: boolean
}

export const navItemSchema: z.ZodType<NavItem> = z.lazy(() =>
  z
    .object({
      label: z.string().describe("Navigation label"),
      path: z.string().optional().describe("Route path or external URL"),
      items: z.array(navItemSchema).optional().describe("Nested navigation items"),
      accordion: z.boolean().optional().describe("Render as collapsible section"),
    })
    .describe("Navigation item")
)

export const docsConfigSchema = z
  .object({
    site: z
      .object({
        name: z.string().describe("Site title"),
        description: z.string().optional().describe("Short site description used in /llms.txt"),
        logo: z.string().optional().describe("Logo image URL or public path"),
        favicon: z.string().optional().describe("Favicon URL or public path"),
        socialBanner: z
          .string()
          .optional()
          .describe("Social preview image (Open Graph/Twitter) URL or path"),
        repo: gitHubRepoSchema.optional().describe("Repository metadata for edit links"),
      })
      .optional()
      .describe("Site metadata"),
    nav: z.array(navItemSchema).optional().describe("Custom navigation sections"),
    links: z
      .object({
        github: z.string().optional().describe("URL to repository or org"),
        issues: z.string().optional().describe("URL to issues page"),
        discord: z.string().optional().describe("URL to Discord server"),
      })
      .optional()
      .describe("External links"),
    theme: z
      .object({
        preset: z.string().optional().describe("Preset theme name (see /theming)"),
        cssFile: z.string().optional().describe("Path to a CSS file in your docs folder"),
      })
      .optional()
      .describe("Theme configuration"),
    llms: z
      .object({
        enabled: z.boolean().optional().describe("Generate /llms.txt at build time"),
        path: z.string().optional().describe("Folder for per-page LLM markdown"),
      })
      .optional()
      .describe("LLM output configuration"),
  })
  .strict()
  .describe("Gittydocs configuration file")

export const docsConfigFileSchema = docsConfigSchema.extend({
  $schema: z.string().optional().describe("JSON Schema reference"),
})

export type DocsConfig = z.output<typeof docsConfigSchema>
export type DocsConfigInput = z.input<typeof docsConfigSchema>
