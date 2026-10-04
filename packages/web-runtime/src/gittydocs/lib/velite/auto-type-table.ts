import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import ts from "typescript-api"

export interface AutoTypeProperty {
  type: string
  description?: string
  default?: string
  required?: boolean
  deprecated?: boolean
}
export type AutoTypeTableData = Record<string, AutoTypeProperty>

/** Render resolved build-time data for readable Markdown exports (no runtime compiler). */
export function autoTypeTableToMarkdown(table: AutoTypeTableData): string {
  const cell = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\|/g, "&#124;")
      .replace(/\r?\n/g, "<br />")
  return [
    "| Property | Type | Required | Default | Description |",
    "| --- | --- | --- | --- | --- |",
    ...Object.entries(table).map(
      ([name, property]) =>
        `| ${cell(name)} | ${cell(property.type)} | ${property.required ? "Yes" : "No"} | ${cell(property.default ?? "—")} | ${cell([property.deprecated ? "Deprecated." : "", property.description ?? ""].filter(Boolean).join(" "))} |`
    ),
  ].join("\n")
}
export interface AutoTypeTableOptions {
  /** Root of the prepared documentation, not the repository root. */
  contentRoot?: string
}

type MdxNode = {
  type: string
  name?: string | null
  attributes?: { type: string; name?: string; value?: unknown }[]
  children?: MdxNode[]
  position?: unknown
}

function within(root: string, file: string) {
  const relative = path.relative(root, file)
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  )
}

function safeFile(root: string, file: string) {
  return within(root, file) && fs.existsSync(file) && within(root, fs.realpathSync(file))
}

/** Build-only API shared by the MDX compiler and readable Markdown exporters. */
export async function resolveAutoTypeTable(input: {
  mdxPath: string
  path: string
  name: string
  contentRoot?: string
}): Promise<AutoTypeTableData> {
  const root = fs.realpathSync(path.resolve(input.contentRoot ?? "content/docs"))
  const authorDirectory = fs.realpathSync(path.dirname(path.resolve(input.mdxPath)))
  const author = path.join(authorDirectory, path.basename(input.mdxPath))
  if (!within(root, author))
    throw new Error("The author MDX file must be inside the docs content root")
  if (!input.path.startsWith("./") && !input.path.startsWith("../")) {
    throw new Error('path must be relative to the author MDX file (start with "./" or "../")')
  }
  const target = path.resolve(path.dirname(author), input.path)
  if (!within(root, target)) throw new Error("path must stay inside the docs content root")
  if (!/\.(?:ts|tsx)$/.test(target)) throw new Error("path must reference a .ts or .tsx file")
  if (!fs.existsSync(target)) throw new Error(`Type source file not found: ${target}`)
  if (!safeFile(root, target))
    throw new Error("Type source symlinks must stay inside the docs content root")
  if (!/^[A-Za-z_$][\w$]*$/.test(input.name))
    throw new Error("name must be a top-level interface or type alias name")

  // Use the classic JS compiler API: TS7's native async filesystem bridge can
  // deadlock under Bun. Keep the CLI's TS7 dependency separate from this API.
  const require = createRequire(import.meta.url)
  const libraryRoot = path.dirname(require.resolve("typescript-api/lib/lib.d.ts"))
  const allowed = (file: string) =>
    safeFile(root, file) ||
    (within(libraryRoot, file) &&
      /^lib\.[\w.]+\.d\.ts$/.test(path.basename(file)) &&
      safeFile(libraryRoot, file))
  const compilerOptions: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    types: [],
    skipLibCheck: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.Preserve,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.Preserve,
  }
  const host = ts.createCompilerHost(compilerOptions)
  host.readFile = (file) => (allowed(file) ? fs.readFileSync(file, "utf8") : undefined)
  host.fileExists = allowed
  host.getCurrentDirectory = () => root
  host.resolveModuleNames = (names, containingFile) =>
    names.map((name) =>
      name.startsWith("./") || name.startsWith("../")
        ? ts.resolveModuleName(name, containingFile, compilerOptions, host).resolvedModule
        : undefined
    )
  host.directoryExists = (directory) => {
    if (!within(root, directory) && !within(libraryRoot, directory)) return false
    return (
      fs.existsSync(directory) &&
      fs.statSync(directory).isDirectory() &&
      (within(root, fs.realpathSync(directory)) || within(libraryRoot, fs.realpathSync(directory)))
    )
  }
  // Do not consult package.json or tsconfig outside the sandbox.
  const program = ts.createProgram([target], compilerOptions, host)
  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    .filter((d) => d.category === ts.DiagnosticCategory.Error)
  if (diagnostics.length) {
    throw new Error(
      `TypeScript diagnostics:\n${diagnostics
        .map((d) => {
          const location =
            d.file && d.start !== undefined
              ? d.file.getLineAndCharacterOfPosition(d.start)
              : undefined
          return `${d.file?.fileName ?? target}${location ? `:${location.line + 1}:${location.character + 1}` : ""} TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`
        })
        .join("\n")}`
    )
  }
  const source = program.getSourceFile(target)
  const declaration = source?.statements.find(
    (statement) =>
      (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) &&
      statement.name.text === input.name
  )
  if (
    !declaration ||
    (!ts.isInterfaceDeclaration(declaration) && !ts.isTypeAliasDeclaration(declaration))
  ) {
    throw new Error(
      `Type "${input.name}" not found in ${target}; expected a top-level interface or type alias`
    )
  }
  if (declaration.typeParameters?.length)
    throw new Error("Generic declarations are not supported; use a concrete type alias")
  const checker = program.getTypeChecker()
  const symbol = checker.getSymbolAtLocation(declaration.name)
  if (!symbol) throw new Error(`Could not resolve type "${input.name}"`)
  const type = checker.getDeclaredTypeOfSymbol(symbol)
  if (!(type.flags & (ts.TypeFlags.Object | ts.TypeFlags.Intersection))) {
    throw new Error(
      "The named type must describe an object; primitive and top-level union types are not supported"
    )
  }
  const table: AutoTypeTableData = Object.create(null)
  for (const property of checker.getPropertiesOfType(type)) {
    const propertyType = checker.getTypeOfSymbolAtLocation(property, declaration)
    const tags = property.getJsDocTags(checker)
    const description = ts.displayPartsToString(property.getDocumentationComment(checker))
    const defaultTag = tags.find((tag) => tag.name === "default" || tag.name === "defaultValue")
    table[property.name] = {
      type: checker.typeToString(propertyType, declaration, ts.TypeFormatFlags.NoTruncation),
      ...(description ? { description } : {}),
      ...(defaultTag ? { default: ts.displayPartsToString(defaultTag.text) } : {}),
      required: !(property.flags & ts.SymbolFlags.Optional),
      ...(tags.some((tag) => tag.name === "deprecated") ? { deprecated: true } : {}),
    }
  }
  return table
}

// Generate ESTree directly from data, never evaluate authored JavaScript.
function expression(value: unknown): object {
  if (value !== null && typeof value === "object") {
    return {
      type: "ObjectExpression",
      properties: Object.entries(value).map(([key, entry]) => ({
        type: "Property",
        kind: "init",
        method: false,
        shorthand: false,
        computed: true,
        key: { type: "Literal", value: key },
        value: expression(entry),
      })),
    }
  }
  return { type: "Literal", value }
}

/** Import-free authoring macro. Only the generated TypeTable reaches the browser. */
export function remarkAutoTypeTable(options: AutoTypeTableOptions = {}) {
  return async (tree: MdxNode, file: { path?: string }) => {
    const visit = async (node: MdxNode): Promise<void> => {
      if (
        (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") &&
        node.name === "AutoTypeTable"
      ) {
        try {
          if (!file.path) throw new Error("The compiler must supply vfile.path")
          if (node.children?.length)
            throw new Error("AutoTypeTable must be self-closing and cannot contain children")
          const props: Record<string, string> = Object.create(null)
          for (const attribute of node.attributes ?? []) {
            if (
              attribute.type !== "mdxJsxAttribute" ||
              !attribute.name ||
              !["path", "name"].includes(attribute.name)
            ) {
              throw new Error(
                "Only literal path and name props are supported; spreads and extra props are not allowed"
              )
            }
            if (typeof attribute.value !== "string" || !attribute.value.trim())
              throw new Error(`${attribute.name} must be a non-empty quoted string literal`)
            if (attribute.name in props) throw new Error(`Duplicate ${attribute.name} prop`)
            props[attribute.name] = attribute.value
          }
          if (!props.path || !props.name) throw new Error("Both path and name props are required")
          const table = await resolveAutoTypeTable({
            mdxPath: file.path,
            path: props.path,
            name: props.name,
            contentRoot: options.contentRoot,
          })
          node.name = "TypeTable"
          node.attributes = [
            {
              type: "mdxJsxAttribute",
              name: "type",
              value: {
                type: "mdxJsxAttributeValueExpression",
                value: JSON.stringify(table),
                data: {
                  estree: {
                    type: "Program",
                    sourceType: "module",
                    body: [{ type: "ExpressionStatement", expression: expression(table) }],
                  },
                },
              },
            },
          ]
        } catch (error) {
          throw new Error(
            `[AutoTypeTable] ${file.path ?? "unknown MDX file"}: ${error instanceof Error ? error.message : String(error)}`,
            { cause: error }
          )
        }
      }
      for (const child of node.children ?? []) await visit(child)
    }
    await visit(tree)
  }
}
