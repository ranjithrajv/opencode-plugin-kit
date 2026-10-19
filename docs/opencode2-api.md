# OpenCode V2 API cheat-sheet for contributors

Everything in this kit is built against the OpenCode v2 plugin API
(`@opencode/plugin`, types-only) and the background service's HTTP API. This
file records the pieces we actually use, so contributors don't have to
rediscover them. Keep it in sync when you adopt a new endpoint or context
surface. Official docs:
<https://opencode.ai/v2/docs/> (plugin API: [/build/plugins](https://opencode.ai/v2/docs/build/plugins),
CLI plugin API: [/build/plugins/cli](https://opencode.ai/v2/docs/build/plugins/cli)).

## The `opencode2 api` command

The background service speaks HTTP. Inspect and call it from the shell:

```sh
opencode2 api get /api/health            # service health
opencode2 api get /openapi.json          # full OpenAPI spec (~119 paths)
opencode2 api get /api/integration       # every integration + connections
opencode2 api post /api/example -d '{"key":"value"}'
```

Responses are wrapped: `{"location": {...}, "data": ...}`. Helpers:
`asArray()` normalizes `{ data: [...] }` / bare arrays; `unwrap()` normalizes
`{ info: {...} }` message entries. Both are in `src/providers.ts`.

## Endpoints this kit (and its consumers) rely on

| Endpoint               | Shape                                         | Used for                                                                                                                                 |
| ---------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/health`      | `{ healthy, version, pid }`                   | Service liveness                                                                                                                         |
| `GET /api/integration` | array of `{ id, name, methods, connections }` | **Connected providers**: `connections` is non-empty only when a key/OAuth credential is added. This is the same source `/connect` reads. |
| `GET /api/provider`    | array of provider descriptors                 | Available providers/settings                                                                                                             |
| `GET /api/plugin`      | plugin activation state                       | Plugin discovery debugging                                                                                                               |
| `GET /openapi.json`    | OpenAPI document                              | Source of truth for every path above                                                                                                     |

Prefer calling these from inside the TUI via the injected client rather than
raw `fetch`: `context.client.integration.list()` returns the same integration
list (typed). Fall back to reading `~/.local/share/opencode/auth.json` only
as a bootstrap cache (see `availableProviders()` in `src/providers.ts`).

## The remote usage endpoint

`usageResponseSchema` in `src/schemas.ts` describes a **remote** opencode.ai
endpoint, not a local path above:

```sh
GET https://opencode.ai/zen/go/v1/usage
Authorization: Bearer <any workspace key — zen or go>
```

Verified against the live endpoint on 2026-10-14. The entire response:

```json
{
  "usage": {
    "rolling": { "status": "ok", "percent": 27, "resetsAt": "2026-10-14T11:47:10.000Z" },
    "weekly": { "status": "ok", "percent": 17, "resetsAt": "2026-10-19T00:00:00.000Z" },
    "monthly": { "status": "ok", "percent": 11, "resetsAt": "2026-11-05T06:16:41.000Z" }
  }
}
```

There is nothing else in the payload — no plan name, no absolute dollar
amounts, no per-model limits, no request counts — so the schema is currently
lossless and consumers render every field the endpoint offers. Re-check with the
usage-quota tracker's `scripts/probe-usage.mjs` before designing a display
around a field that is not in this list.

Window semantics (see <https://opencode.ai/docs/go/>): the percent is
consumption of the model's **monthly dollar allowance**, not of a token count —
5h = 20% of monthly, weekly = 50%, monthly = 100%. The endpoint aggregates the
whole workspace, so its figures are not attributable to a single provider.
`weekly.resetsAt` lands on Monday 00:00 UTC; `monthly.resetsAt` is a cycle
anchor and is generally **not** the 1st of the month.

No other provider publishes a comparable allowance. Zen is pay-per-request
with an optional monthly spend limit that needs a console cookie, and its free
models are capped by an opaque IP-based request limit (`FreeUsageLimitError`,
HTTP 429). Do not model those as 5h/1w/1mo windows.

## Plugin TUI context (`Plugin.Context` from `@opencode/plugin/tui`)

| Surface                                                                 | What it gives you                                                                                    | Kit notes                                                                                                                                                                                                      |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context.client`                                                        | Generated OpenCode API client (typed, same contract as `/openapi.json`)                              | `client.integration.list()` for connected providers                                                                                                                                                            |
| `context.data`                                                          | Reactive session/message/provider caches (`data.session.message.list(id)`, `data.session.list()`, …) | Consumers derive usage from message history here                                                                                                                                                               |
| `context.storage`                                                       | `store(key, { initial })` (durable, cross-TUI) and `memory(key, …)`                                  | `viewPicker.ts` persists the selection here                                                                                                                                                                    |
| `context.ui.slot({ append/prepend/before/after/replace: "…", render })` | Slot tree contributions (see slot tree below)                                                        | `render` receives the slot input **reactively** — reading a Solid signal inside it subscribes. `slot.ts` (`claimSlot`) is the safe wrapper; `statusbar.ts`, `composer.ts` and `panel.ts` claim specific slots. |
| `context.keymap.layer(() => layer)`                                     | Palette/slash/bound commands                                                                         | ⚠️ **Gotcha:** layers are owned by the _calling component_. Registering in `setup()` silently no-ops; register inside a rendered `app` slot's `render` (return `null`). `viewPicker.ts` handles this for you.  |
| `context.ui.dialog`                                                     | `select`, `alert`, `confirm`, `prompt` (promise-based)                                               | `viewPicker.ts` uses `dialog.select`                                                                                                                                                                           |
| `context.ui.toast`                                                      | `show({ title, message, variant })`                                                                  | Switch confirmations                                                                                                                                                                                           |
| `context.ui.panel`                                                      | `open(name, { presentation })`, `close()`, `current()`                                               | Panel management — `panel.ts` owns the `session.panel` slot claim                                                                                                                                              |
| `context.ui.router`                                                     | `register(page)`, `navigate(destination)`, `current()`                                               | Plugin page routing — `router.ts` wraps register + navigate                                                                                                                                                    |
| `context.ui.tabs`                                                       | `enabled()`, `list()`, `open(id)`, `focus(id)`, `move(id, idx)`, `close(id?)`                        | Session tab management — `tabs.ts` wraps all operations                                                                                                                                                        |
| `context.attention`                                                     | `notify({ title, message, notification?, sound? })`                                                  | Attention + sound + notification — `attention.ts` wraps with toast fallback                                                                                                                                    |

### Slot tree

Paths are absolute and dot-separated. A path contains every path it prefixes
(so replacing `prompt.footer` owns everything under `prompt.footer.*`). Each
slot publishes an input, passed reactively to every claim render.

| Slot path              | Input                               |
| ---------------------- | ----------------------------------- |
| `app`                  | none                                |
| `home.footer`          | none                                |
| `home.footer.status`   | none                                |
| `prompt.footer`        | `{ sessionID?, mode, showDetails }` |
| `prompt.footer.status` | `{ sessionID?, mode, showDetails }` |
| `prompt.footer.file`   | `{ sessionID?, mode, showDetails }` |
| `session.composer.top` | `{ sessionID }`                     |
| `session.panel`        | `{ name, sessionID, width, … }`     |
| `sidebar.content`      | `{ sessionID }`                     |
| `sidebar.footer`       | `{ sessionID }`                     |

Which slot (or host service) a plugin should reach for — and the kit module that
owns it — is mapped in **[SURFACES.md](SURFACES.md)**. Every non-sidebar surface
is optional on the host; each kit module degrades to a no-op (or a toast
fallback for `attention.ts`) when the surface is absent.

## Debugging

```sh
opencode2 service restart   # pick up plugin file changes
opencode2 service status
opencode2 --standalone      # TUI with a private server, isolates shared-service issues

# plugin load errors / regressions:
grep -h "failed to load plugin\|your-plugin-id" \
  ~/.local/share/opencode/log/opencode.log | tail -20
```

Plugin files hot-reload on change — a "failed to load plugin" with a
`Unexpected …` syntax error right after editing usually means the server read
a half-written file; reload before treating it as a real regression.

When in doubt about a field name or endpoint shape, trust `/openapi.json` and
the V2 docs — never V1 (`/docs/`) and never memory.
