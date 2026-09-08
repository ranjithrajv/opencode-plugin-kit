# OpenCode V2 API cheat-sheet for contributors

Everything in this kit is built against the OpenCode plugin API and the
background service's HTTP API. This file records the pieces we actually use,
so contributors don't have to rediscover them. Keep it in sync when you adopt
a new endpoint or context surface. Official docs:
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

## Plugin TUI context (`setup(context)`)

| Surface                                             | What it gives you                                                                                    | Kit notes                                                                                                                                                                                                     |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context.client`                                    | Generated OpenCode API client (typed, same contract as `/openapi.json`)                              | `client.integration.list()` for connected providers                                                                                                                                                           |
| `context.data`                                      | Reactive session/message/provider caches (`data.session.message.list(id)`, `data.session.list()`, …) | Consumers derive usage from message history here                                                                                                                                                              |
| `context.storage`                                   | `store(key, { initial })` (durable, cross-TUI) and `memory(key, …)`                                  | `viewPicker.ts` persists the selection here                                                                                                                                                                   |
| `context.ui.slot({ replace/append: "…" , render })` | Slot tree contributions (`sidebar.footer`, `app`, …)                                                 | `render` receives the slot input **reactively** — reading a Solid signal inside it subscribes                                                                                                                 |
| `context.keymap.layer(() => layer)`                 | Palette/slash/bound commands                                                                         | ⚠️ **Gotcha:** layers are owned by the _calling component_. Registering in `setup()` silently no-ops; register inside a rendered `app` slot's `render` (return `null`). `viewPicker.ts` handles this for you. |
| `context.ui.dialog`                                 | `select`, `alert`, `confirm`, `prompt` (promise-based)                                               | `viewPicker.ts` uses `dialog.select`                                                                                                                                                                          |
| `context.ui.toast`                                  | `show({ title, message, variant })`                                                                  | Switch confirmations                                                                                                                                                                                          |

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
