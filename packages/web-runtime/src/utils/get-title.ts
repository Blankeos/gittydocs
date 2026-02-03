import { gittydocsConfig } from "@/gittydocs/lib/docs/config.gen"

const TITLE_TEMPLATE = `%s | ${gittydocsConfig?.site?.name ?? "Docs"}`

export default function getTitle(title: string = "Home") {
  return TITLE_TEMPLATE.replace("%s", title)
}
