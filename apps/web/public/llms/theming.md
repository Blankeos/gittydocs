# Theming

> Customize app.css, choose a preset, and add custom CSS.

gittydocs themes are pure CSS. The default look lives in `app.css`, and themes are just CSS variable overrides. It follows a shadcn-style token setup, so tools like tweakcn work well for live edits and previews. You can pick a preset, add a CSS file, or fully eject for deeper changes.

## Preset themes

These presets are bundled and ready to use:

- `default` ⚪
- `slate` 🪨
- `sage` 🌿
- `ember` 🔥
- `ocean` 🌊
- `sand` 🏖️

Select one in `gittydocs.jsonc`:

```jsonc
// docs/gittydocs.jsonc
{
  "theme": {
    "preset": "ocean",
  },
}
```

Presets work with the existing light/dark toggle. The color palette is driven by CSS variables; the toggle just switches the `light`/`dark` class.

## Custom CSS file

Drop a `theme.css` file in the root of your docs folder. It gets copied to `/static/theme.css` and auto-loaded.

```css
/* docs/theme.css */
:root[data-theme="slate"] {
  --primary: oklch(0.62 0.2 200);
  --accent: oklch(0.92 0.05 200);
}
```

To use a different filename or path (relative to your docs folder), point to it in config:

```jsonc
// docs/gittydocs.jsonc
{
  "theme": {
    "preset": "slate",
    "cssFile": "themes/my-theme.css",
  },
}
```

If you need full control (new layout, typography, or structure changes), eject and edit `apps/web/src/styles/app.css` directly.

## Customize with tweakcn

The live preview script is included out of the box, so you can just open:

[tweakcn.com/editor/theme?p=custom](https://tweakcn.com/editor/theme?p=custom), then make it open http://localhost:3000 or the website you have.

Tweakcn outputs CSS variables. Paste them into `docs/theme.css` (or the file you configured), or drop them into `app.css` after ejecting. This keeps the live preview workflow while staying CSS-only.
