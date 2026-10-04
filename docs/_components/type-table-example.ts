interface BaseOptions {
  /** A label shown to readers. */
  label: string
}

export interface ExampleOptions extends BaseOptions {
  /**
   * The visual treatment of the component.
   * @default "quiet"
   */
  variant?: "quiet" | "strong"
  /**
   * Whether readers can interact with the component.
   * @default true
   */
  interactive?: boolean
  /**
   * Legacy caption text. Use label instead.
   * @deprecated
   */
  caption?: string
}
