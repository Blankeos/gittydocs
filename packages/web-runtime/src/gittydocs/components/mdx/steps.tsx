import { type FlowProps, Show } from "solid-js"

export type StepsProps = FlowProps
export type StepProps = FlowProps<{ title?: string }>

export function Steps(props: StepsProps) {
  return <ol class="mdx-steps">{props.children}</ol>
}

export function Step(props: StepProps) {
  return (
    <li class="mdx-step">
      <Show when={props.title}>
        <div class="mdx-step-title">{props.title}</div>
      </Show>
      <div class="mdx-step-body">{props.children}</div>
    </li>
  )
}
