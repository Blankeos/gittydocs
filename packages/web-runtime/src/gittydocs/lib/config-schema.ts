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
  icon?: string
  newTab?: boolean
  defaultOpen?: boolean
}

const themePresets = ["default", "slate", "sage", "ember", "ocean", "sand"] as const

export const navItemSchema: z.ZodType<NavItem, NavItem> = z.lazy(() =>
  z
    .object({
      label: z.string().describe("Navigation label"),
      path: z.string().optional().describe("Route path or external URL"),
      items: z.array(navItemSchema).optional().describe("Nested navigation items"),
      accordion: z.boolean().optional().describe("Render as collapsible section"),
      icon: z
        .string()
        .optional()
        .describe("Built-in navigation icon name (unknown names use file)"),
      newTab: z.boolean().optional().describe("Open this navigation link in a new tab"),
      defaultOpen: z.boolean().optional().describe("Initially expand this collapsible section"),
    })
    .describe("Navigation item")
)

export const footerNavItemSchema = z
  .object({
    label: z.string().describe("Footer navigation label"),
    path: z.string().describe("Route path or external URL"),
    icon: z.string().optional().describe("Built-in navigation icon name (unknown names use file)"),
    newTab: z
      .boolean()
      .optional()
      .describe(
        "Open in a new tab (default: true for external HTTP(S) URLs, false for internal routes)"
      ),
  })
  .strict()
  .describe("Footer navigation link (no groups or collapsible sections)")

export type FooterNavItem = z.output<typeof footerNavItemSchema>

export const siteVersionSchema = z.union([
  z.string().trim().min(1).describe("Literal version label"),
  z.object({ packageJson: z.string().trim().min(1).describe("Path to package.json") }).strict(),
  z.object({ cargoToml: z.string().trim().min(1).describe("Path to Cargo.toml") }).strict(),
])

export type SiteVersion = z.output<typeof siteVersionSchema>

export const docsConfigSchema = z
  .object({
    site: z
      .object({
        name: z.string().describe("Site title"),
        version: siteVersionSchema
          .optional()
          .describe("Version label or manifest path, relative to the original docs/config folder"),
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
    navFooter: z
      .array(footerNavItemSchema)
      .optional()
      .describe("Ordered sidebar footer links, alongside llms.txt and above the site version"),
    ui: z
      .object({
        breadcrumbs: z.boolean().optional().describe("Show page breadcrumbs (default: true)"),
        pageNavigation: z
          .boolean()
          .optional()
          .describe("Show previous/next page links (default: true)"),
      })
      .optional()
      .describe("Page navigation controls"),
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
        preset: z.enum(themePresets).optional().describe("Preset theme name (see /theming)"),
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

export type DocsConfigInput = z.input<typeof docsConfigSchema>

// Manifest references are build-time inputs, never exposed in generated runtime config.
export type DocsConfig = Omit<z.output<typeof docsConfigSchema>, "site"> & {
  site?: Omit<NonNullable<z.output<typeof docsConfigSchema>["site"]>, "version"> & {
    version?: string
  }
}
