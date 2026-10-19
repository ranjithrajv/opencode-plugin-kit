# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Behaviour-level coverage for the polling fetcher refresh-after-stop and post-error `inFlight()` reset semantics.
- `theme.ts` — `toneColor()` maps semantic tones (`base`, `muted`, `error`, `warning`, `success`, `info`) onto host theme tokens, replacing per-plugin colour branches.
- `util.ts` — `safe()` wraps throw-prone host reads.
- `tokens.ts` — `tokenBreakdown()`, `messageCost()` and `estimateTokens()` normalize v1/v2 token and cost shapes.
- `slot.ts` — `claimSlot()` claims a UI slot and always returns a callable cleanup.
- `panel.ts` — `createPanel()` owns `session.panel` claim, name filtering, host open/close/fullscreen actions and active-state checks.
- `persistedState.ts` — `createPersistedState()` provides a reactive persisted object across the memory, store and signal backends.
- `layout.ts` — `budgetFor()`, `compactFor()` and `columnFor()` centralize sidebar width/row-budget math.
- `format.ts` gains `compactNumber()`, `formatCost()`, `formatDuration()`, `formatClock()`, `formatDelta()`, `formatPercent()`, `shortPath()` and `truncate()`.
- `commands.ts` gains `registerKeymapLayer()` for layers registered from a rendered component.
- `KitSlotOptions` gains `before`/`replace` anchors, `KitUI` gains an optional `panel`, `KitStorage` gains an optional `memory`, and `KitKeymap.layer` accepts an optional layer-level `enabled`.
- `jsonc.ts` — `cleanJsonc()`, `tolerantParse()`, `addPluginSpec()`, `addPluginsKey()`, `removePluginSpec()` and `editPluginsText()` read JSONC and edit a config's `plugins` array textually, preserving comments.
- `hostEvents.ts` — `createHostEvents()` subscribes to host data events and keeps a heartbeat with a polling fallback.
- `catalog.ts` — `listSkillCatalog()`, `syncSkillCatalog()`, `readSkillCatalog()` and `findAgentsMd()` centralize the location/sync/list dance and AGENTS.md discovery.
- `messageIndex.ts` — `createMessageIndex()` builds an incremental, fingerprint-guarded, windowed index of session messages, keyed per context.
- `statusbar.ts` — `createStatusbar()` claims a footer/status slot (`home.footer`, `home.footer.status`, `prompt.footer`, `prompt.footer.status`, `prompt.footer.file`) and degrades to a no-op on hosts without it.
- `composer.ts` — `createComposer()` claims `session.composer.top` and exposes the last render input.
- `palette.ts` — `paletteCommand()`, `registerPaletteCommand()`, `registerPaletteGroup()` and `dynamicPaletteCommand()` register command-palette entries through a rendered `app`-slot keymap layer.
- `router.ts` — `createPage()`, `navigateTo()` and `currentRoute()` register and drive plugin pages on hosts that expose `ui.router`.
- `attention.ts` — `requestAttention()`, `notifyTaskComplete()` and `notifyError()` request a notification/sound and fall back to a toast.
- `tabs.ts` — `createTabs()` reads and controls session tabs (open/focus/move/close/active), no-op on hosts without tab support.
- `KitRouter`, `KitTabs` and `KitAttention` host-contract types; `KitUI` gains optional `router` and `tabs`.
- `QUICKSTART.md` and `examples/hello-plugin/` — a from-scratch guide and a minimal working plugin.
- `docs/SURFACES.md` — maps every plugin surface (sidebar, footer/status, composer, panel, pages, palette, tabs, attention) to the module that owns it.
- `docs/COMPATIBILITY.md` — the published host compatibility matrix.
- `tests/runtime-smoke.test.ts` (`npm run test:smoke`) — imports the real `@opencode/plugin` runtime and executes every kit factory against a host-shaped context, catching import-time and runtime breakage the type-tripwire cannot see.
- `scripts/check-host-compat.mjs` (`npm run check:host-compat`) now runs **both** the type tripwire and the runtime smoke against each pinned `@opencode/plugin` version, reports per-check results, and can refresh the matrix with `--write-matrix`.
- `.github/workflows/host-compat.yml` — a version matrix that runs the compatibility checks on every push and PR.

### Changed

- `tabs.ts` — `active()` and `isOpen()` drop redundant try/catch around the internal `list()`, which already swallows host errors.
- `publish.yml` gains a host-compatibility gate before `npm publish`, so a release that breaks a supported host cannot be published.
- `package.json#files` again includes `dist/` — the built `./collapsible` entry (`dist/collapsible.js`) is the non-development export, so dropping it from the tarball would have broken the published subpath.

## [1.0.0-alpha.7] - 2026-09-28

### Changed

- Widened the `@opencode/plugin` peer range from `^2.0.15` to `^2.0.3`,
  matching what the kit actually supports. Verified by typecheck and the
  type-tripwire against 2.0.3, 2.0.10 and 2.0.18. **2.0.3 is the floor**:
  earlier 2.x releases ship no `./tui` subpath export, so nothing importing
  `@opencode/plugin/tui` can resolve it.
- Documented the 2.0.3 floor in the Compatibility section.
- `CollapsibleSection` and `CollapsibleGroup` take an optional `theme` prop, so
  a consumer can hand down the host's own `usePlugin().theme` instead of the
  kit reaching for the plugin context itself.

### Fixed

- `CollapsibleSection` / `CollapsibleGroup` no longer throw
  `PluginContextProvider is missing` when the kit is installed from `node_modules`.
  Both called `usePlugin()` unconditionally, but a registry install resolves a
  different copy of `@opencode/plugin` and `solid-js` than the one the host
  renders with, so the host's plugin context was never visible. Callers that
  already hold the context pass `theme` down; the `usePlugin()` fallback still
  resolves for deduped module graphs (tests, monorepos) and degrades to unthemed
  text rather than throwing.

## [1.0.0-alpha.6] - 2026-09-23

### Changed

- Migrated the host contract from the legacy V1 plugin beta to the OpenCode v2
  packages `@opencode/plugin` / `@opencode/sdk` / `@opencode/theme` (`2.0.15`,
  types-only optional peer): import paths, `ResolvedTheme` text tokens
  (`text.base` / `text.muted`), and `dialog.select` `placeholder`.
- `palette` / `slash.arguments` are literal types matching the v2 `KeymapCommand`.
- Added `KitModelShape` so the model accessors accept both messages (numeric
  `cost`) and model-list entries / `ModelInfo` (array `cost`).
- `readAuth()` now reads OpenCode 2's SQLite credential store, falling back to
  the legacy `auth.json`.

### Fixed

- `tsconfig.json` no longer excludes `tests/**/*.test-d.ts`. The exclude was
  inherited by Vitest's typechecker, so `host.test-d.ts` — the host-contract
  tripwire — was silently never typechecked.
- Corrected `host.test-d.ts` (missing `KitStorage` import, a non-existent
  `expectTypeOf(...).get()`, and the command subset omitting required `run`).

### Added

- Tests covering the OpenCode 2 SQLite credential store (restores the 100%
  coverage gate).

## [1.0.0-alpha.5] - 2026-09-08

### Fixed

- `collapsible.tsx` now carries a file-level `/** @jsxImportSource @opentui/solid */` pragma. alpha.2 relied on the shipped `tsconfig.json`, but Bun ignores `tsconfig.json` inside `node_modules` — so OpenCode's TUI plugin loader transpiled the file with React's JSX runtime and consumers failed with `Cannot find package 'react'` (e.g. `opencode-plugin-manager`'s sidebar). Matches the documented pattern in opencode's `specs/tui-plugins.md`.

### Added

- Regression test asserting every `src/*.tsx` has the pragma and that Bun can import each one at runtime.

## [1.0.0-alpha.2] - 2026-09-08

### Added

- `./collapsible` subpath export (`CollapsibleSection`/`CollapsibleGroup`) — server entrypoints importing the main index no longer pull `.tsx` through their bundler
- `tsconfig.json` now ships in the package so bun applies the `@opentui/solid` JSX runtime to raw `.tsx` consumed from `node_modules`

### Fixed

- alpha.1 tarball was stale: missing `collapsible.tsx`, `workspace.ts`, `toast.ts`, and the `commands.ts` module

## [1.0.0-alpha.1] - 2026-09-08

### Changed

- **License changed from AGPL-3.0 to MIT**

### Added

- Shared provider vocabulary (`providers.ts`) — Zen/Go provider ids, labels, discovery
- Row formatting (`rows.ts`) — `short()`, `line()`, `bar()`
- Number/date formatting (`format.ts`) — `fmt()`, `fmtCost()`, `until()`
- Storage-backed cache (`cache.ts`) — `createCachedStore()`
- Zod schemas (`schemas.ts`) — usage response, integration list parsing
- View picker (`viewPicker.ts`) — registry + persistence + slash command + dialog + toast
- Current model resolver (`currentModel.ts`) — `resolveCurrentModel()`
- Connected providers tracker (`connectedProviders.ts`) — `createConnectedProviders()`
- Cached resource (`cachedResource.ts`) — `createCachedResource()`
- Message traversal (`messages.ts`) — `walkMessages()`, `sumProviderTokens()`
- Polling fetcher (`pollingFetcher.ts`) — `createPollingFetcher()`
- Session resource (`sidebarSlot.ts`) — `createSessionResource()`
- Toggle command (`commands.ts`) — `createToggle()`, `registerKeymapCommand()`
- Workspace location (`workspace.ts`) — `resolveLocation()`, `workspaceDirectory()`
- Toast helpers (`toast.ts`) — `showToast()`
- Structural host types (`host.ts`) — `KitContext`, `KitMessageShape`
- 147 tests across 13 test files with 100% coverage
- Vite+ developer tooling (format, lint, typecheck)
- GitHub Actions CI
- Pre-commit hooks via `vp staged`

[Unreleased]: https://github.com/ranjithrajv/opencode-plugin-kit/compare/v1.0.0-alpha.7...HEAD
[1.0.0-alpha.7]: https://github.com/ranjithrajv/opencode-plugin-kit/releases/tag/v1.0.0-alpha.7
[1.0.0-alpha.6]: https://github.com/ranjithrajv/opencode-plugin-kit/releases/tag/v1.0.0-alpha.6
[1.0.0-alpha.5]: https://github.com/ranjithrajv/opencode-plugin-kit/releases/tag/v1.0.0-alpha.5
[1.0.0-alpha.1]: https://github.com/ranjithrajv/opencode-plugin-kit/releases/tag/v1.0.0-alpha.1
