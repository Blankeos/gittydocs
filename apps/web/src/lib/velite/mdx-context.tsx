import type { FlowProps, JSX } from "solid-js"
import { MDXProvider } from "solid-jsx"

type HeadingProps = JSX.IntrinsicElements["h1"] & { level?: number }

function HeadingLink(props: HeadingProps) {
  const id = props.id

  const handleClick = () => {
    if (!id) return
    history.replaceState(null, "", `#${id}`)
  }

  const Tag = `h${props.level ?? 1}` as keyof JSX.IntrinsicElements

  return (
    <Tag
      {...props}
      onClick={handleClick}
      class={`${props.class ?? ""} cursor-pointer hover:opacity-80`}
      style={{ "scroll-margin-top": "4rem" }}
    >
      {props.children}
    </Tag>
  )
}

export const mdxComponents: Record<string, (properties: never) => JSX.Element> = {
  h1: (props: any) => <HeadingLink level={1} {...props} />,
  h2: (props: any) => <HeadingLink level={2} {...props} />,
  h3: (props: any) => <HeadingLink level={3} {...props} />,
  h4: (props: any) => <HeadingLink level={4} {...props} />,
  h5: (props: any) => <HeadingLink level={5} {...props} />,
  h6: (props: any) => <HeadingLink level={6} {...props} />,
}

export function MdxContext(props: FlowProps) {
  return <MDXProvider components={mdxComponents}>{props.children}</MDXProvider>
}
