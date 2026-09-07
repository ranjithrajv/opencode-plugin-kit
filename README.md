# opencode-plugin-kit

Shared building blocks for [OpenCode](https://opencode.ai) sidebar plugins —
the pieces that every sidebar widget ends up reimplementing:

- **Provider vocabulary** (`providers.ts`) — Zen/Go provider ids, human
  labels, and defensive shape helpers for beta-API message/model objects.
- **Row formatting** (`rows.ts`) — `short()` id truncation, padded
  `label id (provider) value` lines, and the lean `[━━──]` progress bar.
- **View picker** (`viewPicker.ts`) — the full "switch which view the widget
  shows" pattern: a registry, durable selection via plugin storage, a
  slash/palette command (registered through a keymap layer in an `app` slot,
  the only way it activates), a `dialog.select` picker, and a toast.

Used by [opencode-usage-quota-tracker](../opencode-usage-quota-tracker) and
[opencode-model-recommender](../opencode-model-recommender).

## Usage

```sh
npm i opencode-plugin-kit   # or: bun add / file:../opencode-plugin-kit
```

```ts
import { createViewPicker } from "opencode-plugin-kit"

const picker = createViewPicker(context, {
  registry: [
    { id: "go", title: "Go", description: "Go plan usage" },
    { id: "zen", title: "Zen", description: "Zen usage" },
  ],
  storageKey: "view",
  command: {
    id: "usage.view",
    group: "Usage",
    name: "usage-view",
    title: (v) => `Usage footer: view provider (${v.title})`,
    description: "Pick which provider view the sidebar shows",
  },
  dialog: { title: "Usage view", message: "Choose the provider view" },
  toastPrefix: "Usage footer",
})

picker.registerCommand()
```

`current()` is reactive (Solid signal); the registry is the single extension
point — adding a view is one entry, and the picker, command, persistence, and
renderer all derive from it.

## License

GNU Affero General Public License v3.0 — see [LICENSE](LICENSE).
