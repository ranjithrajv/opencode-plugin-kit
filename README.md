# opencode-plugin-kit

Shared building blocks for [OpenCode](https://opencode.ai) sidebar plugins —
the pieces that every sidebar widget ends up reimplementing:

- **Provider vocabulary** (`providers.ts`) — Zen/Go provider ids, human
  labels, connected-provider discovery (from auth.json, with fallbacks), and
  defensive shape helpers for beta-API message/model objects.
- **Row formatting** (`rows.ts`) — `short()` id truncation, padded
  `label id (provider) value` lines, and the lean `[━━──]` progress bar.
- **Number/date formatting** (`format.ts`) — `fmt()` locale integers,
  `fmtCost()` dollar amounts, and `until()` compact reset countdowns.
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

## Modules

| Module | Exports | Notes |
|---|---|---|
| `providers.ts` | `ZEN_PROVIDER`, `GO_PROVIDER`, `DEFAULT_PROVIDERS`, `providerLabel()`, `unwrap()`, `asArray()`, `modelId()`, `providerId()` | Beta-API shapes read defensively; never throw on unexpected payloads |
| `rows.ts` | `short()`, `line()`, `bar()` | Pure text, no I/O |
| `format.ts` | `fmt()`, `fmtCost()`, `until()` | Pure text, no I/O |
| `schemas.ts` | `windowSchema`, `usageResponseSchema`, `integrationSchema`, `parseUsage()`, `parseIntegrationList()`, `connectedProviderIds()` | Zod schemas for untrusted boundary shapes; parse functions return `null` on mismatch so callers degrade to last-known-good |
| `viewPicker.ts` | `PickerOption`, `PickerConfig`, `createViewPicker()` | See usage above; `selectable` gates views (e.g. connected-provider checks) |

Everything is re-exported from the package root (`src/index.ts`).

## Consuming plugins

- [opencode-usage-quota-tracker](../opencode-usage-quota-tracker) — sidebar
  footer with per-provider usage, plan quota, and the Zen free-tier breakdown
- [opencode-model-recommender](../opencode-model-recommender) — model
  recommendations by cache ratio, token cost, and session cost

Link locally with `"opencode-plugin-kit": "file:../opencode-plugin-kit"` in
the consumer's `package.json`, then `npm install` (or `bun install`).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) — and keep
[docs/opencode2-api.md](docs/opencode2-api.md) in sync if your change adopts
a new OpenCode API surface. For the OpenCode V2 API surfaces the
kit builds on — service endpoints, the injected plugin context, and debugging
recipes — see [docs/opencode2-api.md](docs/opencode2-api.md).

## License

GNU Affero General Public License v3.0 — see [LICENSE](LICENSE).
