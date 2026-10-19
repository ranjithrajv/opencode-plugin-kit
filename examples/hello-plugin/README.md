# Hello Plugin

A minimal [OpenCode](https://opencode.ai) sidebar plugin that demonstrates
the three most common `opencode-plugin-kit` patterns:

1. **`createCachedStore`** — Persist UI state across TUI restarts with
   stale-while-revalidate support.
2. **`createViewPicker`** — A slash command + dialog + toast for switching
   between views.
3. **Formatting helpers** — `fmtCost()`, `formatDuration()`, and other pure
   formatting functions for consistent display.

## File structure

```
hello-plugin/
├── package.json    # Plugin manifest with peer deps
├── index.ts        # Plugin entry point (setup + render)
└── README.md       # This file
```

## How it works

The plugin registers a sidebar footer widget that shows:

```
Hello {name}! View: {view} | {tokens} tokens | {cost} | {duration}
```

- **Name** is persisted via `createCachedStore` (survives TUI restarts).
- **View** is switched via `/hello-view` (a slash command registered by
  `createViewPicker`).
- **Tokens / cost / duration** are formatted with the kit's pure helpers.

## Using this as a template

1. Copy this directory to your plugin project.
2. Update `package.json` with your plugin's `id` and `name`.
3. Replace the widget content with your own render logic.
4. Add kit modules as needed — import from `opencode-plugin-kit`.

## Development

Link the kit for local development:

```sh
# In this directory
npm install
npm link ../..
```

Then restart the OpenCode TUI:

```sh
opencode2 service restart
```
