# Quickstart: Build an OpenCode Plugin with opencode-plugin-kit

This guide walks through creating a minimal OpenCode sidebar plugin using
the kit. By the end you'll have a working plugin that persists state, responds
to a slash command, and formats data consistently.

## Prerequisites

- [OpenCode](https://opencode.ai) v2 installed (`opencode2 --version`)
- Node.js 20+ and npm
- A text editor

## Step 1: Scaffold the plugin

Create a new directory for your plugin:

```sh
mkdir my-opencode-plugin && cd my-opencode-plugin
```

Create `package.json`:

```json
{
  "name": "my-opencode-plugin",
  "version": "1.0.0",
  "type": "module",
  "plugin": {
    "id": "my-plugin",
    "name": "My Plugin"
  },
  "peerDependencies": {
    "@opencode/plugin": "^2.0.3",
    "solid-js": "^1.9.12"
  },
  "dependencies": {
    "opencode-plugin-kit": "^1.0.0-alpha.8"
  }
}
```

Create `index.ts`:

```ts
import type { Context } from "@opencode/plugin/tui/context"
import { createCachedStore } from "opencode-plugin-kit"

export default {
  id: "my-plugin",
  name: "My Plugin",
  setup(context: Context) {
    const store = createCachedStore<string>(context, "my-plugin.greeting", {
      initial: "Hello",
      staleAfterMs: 30_000,
    })

    context.ui.slot({
      append: "sidebar.footer",
      render: () => ({
        type: "text",
        content: store.value,
      }),
    })

    return () => {}
  },
}
```

## Step 2: Install and link

```sh
npm install
```

For local development, link the kit:

```sh
npm link /path/to/opencode-plugin-kit
```

## Step 3: Register the plugin

Add your plugin to the OpenCode config (`~/.config/opencode/config.jsonc`):

```jsonc
{
  "plugins": ["my-opencode-plugin"],
}
```

Or install it from npm:

```sh
npm install -g my-opencode-plugin
```

## Step 4: Restart and test

```sh
opencode2 service restart
```

Launch the TUI:

```sh
opencode2
```

You should see "Hello" in the sidebar footer.

## Step 5: Add a slash command

Replace `index.ts` with a version that includes a view picker:

```ts
import type { Context } from "@opencode/plugin/tui/context"
import { createViewPicker, createCachedStore, fmtCost } from "opencode-plugin-kit"

export default {
  id: "my-plugin",
  name: "My Plugin",
  setup(context: Context) {
    const store = createCachedStore<number>(context, "my-plugin.tokens", {
      initial: 0,
      staleAfterMs: 60_000,
    })

    const picker = createViewPicker(context, {
      registry: [
        { id: "tokens", title: "Tokens", description: "Show token count" },
        { id: "cost", title: "Cost", description: "Show cost in USD" },
      ],
      storageKey: "my-plugin.view",
      command: {
        id: "my-plugin.view",
        group: "My Plugin",
        name: "my-view",
        title: (v) => `My Plugin: view (${v.title})`,
        description: "Switch the widget view",
      },
      dialog: { title: "My Plugin view", message: "Choose what to display" },
      toastPrefix: "My Plugin",
    })
    picker.registerCommand()

    context.ui.slot({
      append: "sidebar.footer",
      render: () => {
        const view = picker.current()
        const tokens = store.value
        const content = view.id === "cost" ? `Cost: ${fmtCost(tokens * 0.0001)}` : `Tokens: ${tokens.toLocaleString()}`
        return { type: "text", content }
      },
    })

    return () => {}
  },
}
```

Now you can type `/my-view` in the TUI to switch between "Tokens" and "Cost"
views. The selection persists across TUI restarts.

## Step 6: Add formatting helpers

The kit provides pure formatting functions for common display patterns:

```ts
import {
  fmtCost, // 0.042 → "$0.042"
  formatDuration, // 3_661_000 → "1h 1m"
  formatPercent, // 0.27 → "27%"
  compactNumber, // 12500 → "12.5K"
  shortPath, // /home/user/project → "~/project"
  truncate, // "very long text" → "very…"
} from "opencode-plugin-kit"
```

## Next steps

- **Full API reference**: [README.md](README.md)
- **Example plugin**: [`examples/hello-plugin/`](examples/hello-plugin/)
- **Contributing**: [CONTRIBUTING.md](CONTRIBUTING.md)
- **OpenCode plugin docs**: https://opencode.ai/v2/docs/build/plugins
