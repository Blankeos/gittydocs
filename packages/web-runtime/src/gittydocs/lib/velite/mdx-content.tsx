import { createMemo, type JSX } from "solid-js"
import * as runtime from "solid-jsx"
import { useMDXComponents } from "solid-jsx"

interface MdxProps {
  code: string
}

function useMDXComponent(code: string) {
  const fn = new Function(code) as (rt: any) => { default: any }
  return createMemo(() => fn({ ...runtime }).default) as any
}

export function MdxContentStatic(props: MdxProps): JSX.Element {
  const Component = useMDXComponent(props.code)
  const components: any = useMDXComponents({})

  return <Component components={components} />
}
