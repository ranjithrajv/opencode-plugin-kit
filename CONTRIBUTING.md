# Contributing to opencode-plugin-kit

Thanks for improving the kit. This file covers the ground rules; the API
surface is documented in [README.md](README.md).

## What belongs here (and what doesn't)

The kit exists to stop every OpenCode sidebar plugin from reimplementing the
same pieces. Add a module only if **two or more plugins need it**:

✅ Good fits — provider-id vocabulary, beta-API shape helpers, row/text
formatting, the view-picker pattern, connection/auth discovery helpers.

❌ Poor fits — plugin-specific business logic (quota math, recommendation
ranking, free-tier estimation), slot/renderer wiring that differs per plugin,
anything that needs plugin storage keys other than via a config option.

When in doubt, keep it out until a second consumer needs it.

## Ground rules

- **License**: AGPL-3.0. New files start with the project's standard header
  or a one-line SPDX comment; by contributing you agree your work is
  distributed under AGPL-3.0.
- **No build step.** The package ships TypeScript source (`exports` point at
  `.ts` files); consumers compile it with their own `tsc`. Do not add a
  bundler or emit `dist/`.
- **Defensive reads only.** The OpenCode plugin API is beta; every helper
  that touches message/model/API shapes must read defensively (`??`, optional
  chaining) and return empty values rather than throw. `unwrap()` /
  `asArray()` in `providers.ts` are the canonical examples.
- **Pure text helpers stay pure.** `rows.ts` and `format.ts` do no I/O. If a
  helper needs the filesystem, network, or plugin context, it belongs in a
  context-taking module (like `viewPicker.ts`) or in the consuming plugin.
- **No new runtime dependencies.** Runtime deps are peer-only (`solid-js`,
  `@opentui/*`, `@opencode-ai/plugin` per the consumers' own setup) plus
  `zod` — allowed only in `schemas.ts` for boundary-shape parsing. Dev
  deps: `typescript`, `@types/node`, `prettier`, `lint-staged`, `husky`.

## Development loop

```sh
bun install            # or: npm install
bun run typecheck      # tsc --noEmit — must pass with zero errors
npx prettier --write . # formatting is enforced via lint-staged on commit
```

Pre-commit (husky + lint-staged) runs Prettier on staged files. Commits must
pass typecheck before push; keep `tsc --noEmit` clean at every commit.

Commits follow Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`,
`chore:`). Bump the version in `package.json` and add a `CHANGELOG.md` entry
for anything user-visible.

## Testing changes against consumers

There is no unit test suite; the two consumers are the tests. Link locally
and verify both:

```sh
# in the consumer package
bun add ../opencode-plugin-kit        # or npm i file:../opencode-plugin-kit
bun run typecheck
```

Then restart the TUI (`opencode2 service restart`, then relaunch `opencode2`)
and exercise the affected feature: `/usage-view` and `/model-view` for the
picker, sidebar footers for row/format changes.

Check the server log for regressions:

```sh
grep -h "failed to load plugin\|usage-quota-tracker\|model-recommender" \
  ~/.local/share/opencode/log/opencode.log | tail -20
```

## Adding a module

1. Create `src/<module>.ts` with a one-line purpose comment at the top.
2. Export it from `src/index.ts`.
3. Document it in the README's module table.
4. If it's a second pattern (like the picker), give it the same ergonomics:
   config-object entry point, registry as the single extension point, and a
   documented gotcha where relevant (e.g. keymap layers must register from a
   rendered `app` slot — a plain `setup()` registration silently no-ops).
5. Refactor at least one consumer to use it in the same PR — a kit module
   with no consumer is dead code.

## OpenCode API reference

Before touching anything that calls the service or the plugin context, read
[docs/opencode2-api.md](docs/opencode2-api.md) — it documents the endpoints
we rely on (`/api/integration` for connected providers, `/api/health`,
`/openapi.json`), the injected TUI context surfaces (`client`, `data`,
`storage`, `ui.slot`, `keymap`), the keymap-in-`app`-slot gotcha, and
debugging recipes (`opencode2 api`, service restart, log greps). Keep it in
sync when you adopt a new API surface.

## Reporting issues

Open an issue with the OpenCode version (`opencode2 --version`), the plugin
versions, and the relevant slice of `~/.local/share/opencode/log/opencode.log`
with API keys, tokens, and session contents redacted.
