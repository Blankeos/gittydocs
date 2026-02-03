import fs from "node:fs/promises"
import path from "node:path"
import { z } from "zod"
import { docsConfigFileSchema } from "../src/gittydocs/lib/config-schema"

const schemaId = "https://raw.githubusercontent.com/blankeos/gittydocs/main/gittydocs.schema.json"

try {
  await generateSchema()
  console.log("✓ config schema generated")
} catch (error) {
  console.error("✗ config schema generation failed:", error)
  process.exit(1)
}

async function generateSchema() {
  const projectRoot = path.resolve(process.cwd(), "..", "..")
  const outputPath = path.join(projectRoot, "gittydocs.schema.json")
  const schema = z.toJSONSchema(docsConfigFileSchema, {
    target: "draft-07",
  })

  schema.$schema = "http://json-schema.org/draft-07/schema#"
  schema.$id = schemaId
  schema.title = schema.title || "GittydocsConfig"

  await fs.writeFile(outputPath, `${JSON.stringify(schema, null, 2)}\n`, "utf-8")
}
