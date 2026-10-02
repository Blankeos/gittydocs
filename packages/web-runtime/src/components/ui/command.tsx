import type { DialogRootProps } from "@kobalte/core/dialog"
import * as CommandPrimitive from "cmdk-solid"
import type { Component, ComponentProps, ParentProps, VoidProps } from "solid-js"
import { splitProps } from "solid-js"

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/utils/cn"

const Command: Component<ParentProps<CommandPrimitive.CommandRootProps>> = (props) => {
  const [local, others] = splitProps(props, ["class"])

  return (
    <CommandPrimitive.CommandRoot
      class={cn(
        "flex size-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground blur-none",
        local.class
      )}
      {...others}
    />
  )
}

type CommandDialogProps = ParentProps<DialogRootProps> & {
  title?: string
  description?: string
  commandProps?: CommandPrimitive.CommandRootProps
}

const CommandDialog: Component<CommandDialogProps> = (props) => {
  const [local, others] = splitProps(props, ["children", "title", "description", "commandProps"])

  return (
    <Dialog {...others}>
      <DialogContent
        showClose={false}
        class="top-[8%] left-1/2 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 translate-y-0 gap-0 overflow-hidden rounded-xl p-0 sm:top-[8%]"
      >
        <DialogTitle class="sr-only">{local.title ?? "Command menu"}</DialogTitle>
        <DialogDescription class="sr-only">
          {local.description ?? "Search and select an item using the arrow keys and Enter."}
        </DialogDescription>
        <Command {...local.commandProps}>{local.children}</Command>
      </DialogContent>
    </Dialog>
  )
}

const CommandInput: Component<
  VoidProps<CommandPrimitive.CommandInputProps> & { onClose?: () => void }
> = (props) => {
  const [local, others] = splitProps(props, ["class", "onClose"])

  return (
    <div class="relative flex items-center border-b px-3" cmdk-input-wrapper="">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="mr-2 size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      >
        <path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" />
        <path d="M21 21l-6 -6" />
      </svg>
      <CommandPrimitive.CommandInput
        class={cn(
          "flex h-11 w-full rounded-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          local.onClose && "pr-14",
          local.class
        )}
        {...others}
      />
      {local.onClose && (
        <button
          type="button"
          onClick={() => local.onClose?.()}
          aria-label="Close search dialog"
          class="absolute top-1/2 right-3 inline-flex h-5 -translate-y-1/2 select-none items-center rounded border border-border bg-muted px-1.5 font-medium font-mono text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <kbd class="pointer-events-none font-inherit">ESC</kbd>
        </button>
      )}
    </div>
  )
}

const CommandList: Component<ParentProps<CommandPrimitive.CommandListProps>> = (props) => {
  const [local, others] = splitProps(props, ["class"])

  return (
    <CommandPrimitive.CommandList
      class={cn(
        "max-h-[min(440px,55vh)] scroll-py-2 overflow-y-auto overflow-x-hidden",
        local.class
      )}
      {...others}
    />
  )
}

const CommandEmpty: Component<ParentProps<CommandPrimitive.CommandEmptyProps>> = (props) => {
  const [local, others] = splitProps(props, ["class"])

  return (
    <CommandPrimitive.CommandEmpty
      class={cn("py-6 text-center text-sm", local.class)}
      {...others}
    />
  )
}

const CommandGroup: Component<ParentProps<CommandPrimitive.CommandGroupProps>> = (props) => {
  const [local, others] = splitProps(props, ["class"])

  return (
    <CommandPrimitive.CommandGroup
      class={cn(
        "overflow-hidden px-0 py-1 text-foreground [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:text-xs",
        local.class
      )}
      {...others}
    />
  )
}

const CommandSeparator: Component<VoidProps<CommandPrimitive.CommandSeparatorProps>> = (props) => {
  const [local, others] = splitProps(props, ["class"])

  return <CommandPrimitive.CommandSeparator class={cn("h-px bg-border", local.class)} {...others} />
}

const CommandItem: Component<ParentProps<CommandPrimitive.CommandItemProps>> = (props) => {
  const [local, others] = splitProps(props, ["class"])

  return (
    <CommandPrimitive.CommandItem
      cmdk-item=""
      class={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-none border-transparent border-l-2 px-3 py-1.5 text-sm outline-none aria-selected:border-l-primary aria-selected:bg-accent aria-selected:font-medium aria-selected:text-accent-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
        local.class
      )}
      {...others}
    />
  )
}

const CommandShortcut: Component<ComponentProps<"span">> = (props) => {
  const [local, others] = splitProps(props, ["class"])

  return (
    <span
      class={cn("ml-auto text-muted-foreground text-xs tracking-widest", local.class)}
      {...others}
    />
  )
}

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
}
