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

| Module                  | Exports                                                                                                                                                                                                  | Notes                                                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `providers.ts`          | `ZEN_PROVIDER`, `GO_PROVIDER`, `DEFAULT_PROVIDERS`, `providerLabel()`, `unwrap()`, `asArray()`, `modelId()`, `providerId()`, `readAuth()`, `authKey()`, `hasKey()`, `authKeys()`, `availableProviders()` | Beta-API shapes read defensively; never throw on unexpected payloads. auth.json is parsed in exactly one place             |
| `rows.ts`               | `short()`, `line()`, `bar()`                                                                                                                                                                             | Pure text, no I/O                                                                                                          |
| `format.ts`             | `fmt()`, `fmtCost()`, `until()`                                                                                                                                                                          | Pure text, no I/O                                                                                                          |
| `cache.ts`              | `createCachedStore()`                                                                                                                                                                                    | Storage-backed cache with instant restore after TUI restarts and staleness tracking                                        |
| `schemas.ts`            | `windowSchema`, `usageResponseSchema`, `integrationSchema`, `parseUsage()`, `parseIntegrationList()`, `connectedProviderIds()`                                                                           | Zod schemas for untrusted boundary shapes; parse functions return `null` on mismatch so callers degrade to last-known-good |
| `viewPicker.ts`         | `PickerOption`, `PickerConfig`, `createViewPicker()`                                                                                                                                                     | See usage above; `selectable` gates views (e.g. connected-provider checks)                                                 |
| `currentModel.ts`       | `resolveCurrentModel()`, `createCurrentModelResolver()`                                                                                                                                                  | Resolve the model a session is actually using from its last assistant message                                              |
| `connectedProviders.ts` | `createConnectedProviders()`                                                                                                                                                                             | Reactive connected-providers tracker: polls integration list with auth.json + env-var fallbacks                            |
| `cachedResource.ts`     | `createCachedResource()`                                                                                                                                                                                 | Stale-while-revalidate resource: combines `createResource` + `createCachedStore` into one primitive                        |
| `messages.ts`           | `walkMessages()`, `sumProviderTokens()`, `cacheReadInput()`                                                                                                                                              | Defensive message traversal: fold over a session's messages with provider/time-window scoping                              |
| `pollingFetcher.ts`     | `createPollingFetcher()`                                                                                                                                                                                 | Polling fetcher with throttling, in-flight guard, and last-known-good retention                                            |
| `sidebarSlot.ts`        | `createSessionResource()`                                                                                                                                                                                | Session-reactive data resource for sidebar slots                                                                           |
| `host.ts`               | `KitContext`, `KitMessageShape`, `ToastInput`, `SelectOption`                                                                                                                                            | Structural minimum types for the host context kit consumes                                                                 |

Everything is re-exported from the package root (`src/index.ts`).

## Compatibility with `@opencode-ai/plugin`

The host plugin API is beta; its types are the spec. Kit plays nice with it by
consuming the context, never installing the SDK:

- **No runtime dependency.** Kit imports the host SDK only for types. Whatever
  the host calls `setup()` with is passed into kit's factories untouched.
- **Optional peer dependency.** `@opencode-ai/plugin` is declared as an
  _optional_ peer (`>=1.18.25 <2 || 0.0.0-beta-19242`) so consumers share one
  copy; the exact beta is pinned in kit's devDependencies for CI only. Never
  depend on the moving `beta` tag.
- **Structural minimum.** `KitContext` (in `src/host.ts`) declares only the
  surfaces kit reads — storage, ui (toast/dialog/slot), keymap, session
  messages, integration list. Anything the host ships with those members
  satisfies it; extra host fields are ignored.
- **Typed ambiguity.** Known beta drift (raw messages vs `{ info }`
  envelopes, `tokens.cache.read` as number vs `{ input }`, `time.created` vs
  `timeCreated`) is modeled as unions on `KitMessageShape` with shared
  readers (`unwrap()`, `cacheReadInput()`), so a new host shape is one edit
  in kit, not four plugins.
- **CI tripwire.** `bun run test:types` runs `expectTypeOf` assertions
  (`src/host.test-d.ts`) pinning the published host types
  (`AssistantMessage`, `TuiToast`, `TuiDialogSelectOption`, `TuiCommand`)
  against kit's contract. A host upgrade that drifts fails CI with a
  readable diff instead of breaking users' sidebars at runtime.

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

Platform patterns proposed for upstreaming into the official plugin API are
tracked in [docs/UPSTREAM.md](docs/UPSTREAM.md) — absorbing a pattern
upstream and deleting it here is the project's exit goal, not a failure.

## License

GNU Affero General Public License v3.0 — see [LICENSE](LICENSE).
