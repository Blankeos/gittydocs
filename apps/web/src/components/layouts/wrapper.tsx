import type { FlowProps } from "solid-js"
import { Toaster } from "solid-sonner"
import { ThemeContextProvider, useThemeContext } from "@/contexts/theme.context"

export default function Wrapper(props: FlowProps) {
  return (
    <ThemeContextProvider>
      {props.children}
      <_Toaster />
    </ThemeContextProvider>
  )
}

function _Toaster() {
  const { inferredTheme } = useThemeContext()
  return <Toaster theme={inferredTheme()} richColors />
}
