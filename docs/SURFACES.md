# Plugin surfaces

An OpenCode plugin does not "draw a sidebar" — it claims **surfaces**: named
places in the TUI where it renders, plus the host services around them (the
command palette, the router, notifications). The host publishes a fixed set of
these; the kit gives you one tested module per surface.

This guide is the "which surface, and what do I call" map. It is the single
source of truth for **which module owns which surface** — nothing else in the
docs repeats that mapping.

## Where things live

| Question                                    | Canonical doc                           |
| ------------------------------------------- | --------------------------------------- |
| Which surface, which module, when to use it | **this file** (SURFACES.md)             |
| Exact signatures, options, return shapes    | [README.md](../README.md) API Reference |
| Host APIs, slot tree, endpoints, debugging  | [opencode2-api.md](opencode2-api.md)    |
| Which host builds are verified              | [COMPATIBILITY.md](COMPATIBILITY.md)    |

Snippets below are intentionally minimal; the README's API Reference is the
place for options.

## Which surface do I want?

| I want to…                                         | Surface                              | Kit module     |
| -------------------------------------------------- | ------------------------------------ | -------------- |
| Show live data in the sidebar                      | `sidebar.content` / `sidebar.footer` | `slot.ts`      |
| Put a line in the footer / status bar              | `*.footer` / `*.footer.status`       | `statusbar.ts` |
| Add a hint or preview above the prompt             | `session.composer.top`               | `composer.ts`  |
| Open a full-screen or side panel                   | `session.panel`                      | `panel.ts`     |
| Add a full-screen settings/about page              | router page                          | `router.ts`    |
| Add a palette command, slash command or keybinding | command palette                      | `palette.ts`   |
| Observe or drive session tabs                      | `ui.tabs`                            | `tabs.ts`      |
| Notify the user (sound / desktop notification)     | `attention`                          | `attention.ts` |

Every surface except the sidebar is **optional on the host**. Each module checks
before it acts: a missing surface yields a no-op (or, for attention, a toast)
rather than a throw out of `setup()`.

## The surfaces

### Sidebar — `slot.ts`

The default home. `claimSlot()` wraps `ui.slot(...)` in the try/catch every
plugin writes by hand and guarantees a callable cleanup.

```ts
const cleanup = claimSlot(context, {
  append: "sidebar.footer",
  render: () => <Row />, // reactive: reading a signal here subscribes
})
```

`render` is **reactive** — reading a Solid signal inside it subscribes and
re-renders. A plain JS variable read there will not. See the slot tree in
[opencode2-api.md](opencode2-api.md#slot-tree).

### Footer / status bar — `statusbar.ts`

`createStatusbar()` claims one of the footer/status slots and names it, so the
intent is legible: `home.footer`, `home.footer.status`, `prompt.footer`,
`prompt.footer.status`, `prompt.footer.file`.

```ts
const bar = createStatusbar(context, {
  slot: "prompt.footer.status",
  render: () => <Status />,
})
```

### Input composer — `composer.ts`

`createComposer()` claims `session.composer.top` for preamble UI (autocomplete
hints, context previews) and exposes the last render input so you can read the
active `sessionID`.

```ts
const composer = createComposer(context, { render: (input) => <Hint sessionID={input?.sessionID} /> })
```

### Session panel — `panel.ts`

`createPanel()` claims `session.panel`, filters renders to your panel's name,
and exposes an imperative controller over the host's open/close/fullscreen
actions. The claim happens immediately, so a later setup failure can't strand it.

```ts
const { controller, cleanup } = createPanel(context, { name: "usage", render: (i) => <Panel input={i} /> })
controller.open("fullscreen")
```

### Pages — `router.ts`

`createPage()` registers a full-screen page and returns navigation helpers;
`navigateTo()` / `currentRoute()` are the imperative/read counterparts. On a host
without a router the handle is inert.

```ts
const page = createPage(context, { name: "usage.settings", render: () => <Settings /> })
page.navigate()
```

### Command palette — `palette.ts`

Palette, slash and keybinding commands all ride the keymap, and a keymap layer
is owned by the component that registers it — so commands must be registered
from a rendered `app` slot, never from `setup()` directly. `palette.ts` owns that
dance.

```ts
registerPaletteCommand(context, { id: "usage.view", title: "Usage: view", slash: { name: "usage-view" }, run })
registerPaletteGroup(context, { group: "Usage", commands: [a, b] })
```

See also `commands.ts` for `createToggle()` and lower-level layer registration.

### Session tabs — `tabs.ts`

`createTabs()` reads and drives tabs (`open`, `focus`, `move`, `close`, `active`)
with the usual optional-surface fallback.

```ts
createTabs(context).focus(sessionID)
```

### Attention — `attention.ts`

`requestAttention()` raises a desktop notification and/or sound, falling back to
a toast when the host lacks attention support. `notifyTaskComplete()` and
`notifyError()` are the common recipes.

```ts
await notifyTaskComplete(context, "Quota refreshed")
```

## Composing surfaces

A real plugin usually mixes several. The usage-quota tracker, for example,
renders in the sidebar **and** the footer, exposes a `/usage-view` palette
command via `viewPicker.ts`, and can open a detail panel. The modules share the
same `context`, the same defensive contract, and the same storage — so they
compose without coordination.

## Compatibility

Which host builds provide which surface is tracked in
[COMPATIBILITY.md](COMPATIBILITY.md). A surface that arrived after the `2.0.3`
floor still degrades safely on the older host.
