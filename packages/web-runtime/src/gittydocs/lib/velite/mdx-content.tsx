import { createComponent, type JSX, mergeProps } from "solid-js"
import { Dynamic } from "solid-js/web"
import { useMDXComponents } from "solid-jsx"

interface MdxProps {
  code: string
}

type MdxRuntimeProps = Record<string, unknown> | undefined

const Fragment = (props: { children?: JSX.Element }) => props.children as JSX.Element

function normalizeProps(props: MdxRuntimeProps) {
  if (!props) return props
  if ("className" in props) {
    const { className, ...rest } = props as { className?: string } & Record<string, unknown>
    return { ...rest, class: className }
  }
  return props
}

function mdxJsx(type: unknown, props: MdxRuntimeProps) {
  if (typeof type === "function") return type(props ?? {})
  const normalized = normalizeProps(props) ?? {}
  return createComponent(Dynamic as any, mergeProps(normalized, { component: type }))
}

function useMDXComponent(code: string) {
  const fn = new Function(code) as (rt: any) => { default: any }
  return fn({ Fragment, jsx: mdxJsx, jsxs: mdxJsx }).default
}

export function MdxContentStatic(props: MdxProps): JSX.Element {
  const Component = useMDXComponent(props.code)
  const components: any = useMDXComponents({})

  return <Component components={components} />
}
