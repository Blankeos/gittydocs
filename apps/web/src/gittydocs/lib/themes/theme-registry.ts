export const themeRegistry = [
  {
    id: "default",
    label: "Default",
    description: "Neutral baseline with soft blues.",
  },
  {
    id: "slate",
    label: "Slate",
    description: "Cool blue-gray with crisp accents.",
  },
  {
    id: "sage",
    label: "Sage",
    description: "Soft botanical greens and calm surfaces.",
  },
  {
    id: "ember",
    label: "Ember",
    description: "Warm amber tones with a grounded feel.",
  },
  {
    id: "ocean",
    label: "Ocean",
    description: "Teal-forward palette with deep blues.",
  },
  {
    id: "sand",
    label: "Sand",
    description: "Sunlit neutrals with gentle warmth.",
  },
] as const

export type ThemePreset = (typeof themeRegistry)[number]["id"]
