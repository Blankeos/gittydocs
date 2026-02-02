# Motivation

> Why gittydocs exists.

Already lots of SSG tools out there, why another one? I made gittydocs because I wanted to make docs from scratch w/ my preferred defaults for every project. To make it easier, I wanted something that:

- **Just works** — minimal setup, no paradigms to master, no services to sign up for, no monthly fees
- **Lives close to my code** — docs in the same repo as my Rust projects
- **Has good defaults** — the styling and UX I actually want, out of the box
- **Is minimal** — no bloat, no unnecessary features
- **Still customizable** - themable if out of the box, ejectable if I want MASSIVE customization.
- **Is AI-friendly** — fast for LLMs to understand and work with
- **Has zero friction** — write MDX, push to GitHub, done

I also wanted to build an SSG solution around [SolidJS](https://www.solidjs.com) and [Vike](https://www.vike.dev). I think this is just good to have around its ecosystem.

## Who is this for?

- **You have a Rust project** and want readable, searchable docs without the hassle
- **You want AI to write your docs** (see [AI Docs Prompt](/ai-docs-prompt))

That's it. Write `.mdx`, add a `.jsonc`, push to GitHub. Get a docs site.
