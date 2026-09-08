# Contributing to opencode-plugin-kit

Thanks for improving the kit. This file covers the ground rules; the API
surface is documented in [README.md](README.md).

## What belongs here (and what doesn't)

The kit exists to stop every OpenCode sidebar plugin from reimplementing the
same pieces. Add a module only if **two or more plugins need it**:

Good fits — provider-id vocabulary, beta-API shape helpers, row/text
formatting, the view-picker pattern, connection/auth discovery helpers.

Poor fits — plugin-specific business logic (quota math, recommendation
ranking, free-tier estimation), slot/renderer wiring that differs per plugin,
anything that needs plugin storage keys other than via a config option.

When in doubt, keep it out until a second consumer needs it.

## Ground rules

- **License**: MIT. New files start with the project's standard header
  or a one-line SPDX comment; by contributing you agree your work is
  distributed under MIT.
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
  `zod` — allowed only in `schemas.ts` for boundary-shape parsing.
- **100% test coverage.** All new code must include tests that maintain 100%
  line, branch, function, and statement coverage.

## Development loop

```sh
vp install            # install dependencies
vp check              # format + lint + typecheck
vp check --fix        # auto-fix issues
vp fmt                # format code
vp lint               # lint code
vp test               # run tests
vp test --coverage    # run tests with coverage
```

Pre-commit hooks run `vp staged` (format + lint + typecheck on staged files).
Commits must pass CI before push.

Commits follow Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`,
`chore:`). Bump the version in `package.json` and add a `CHANGELOG.md` entry
using [CHANGELOG_TEMPLATE.md](CHANGELOG_TEMPLATE.md) — bullets grouped into
the semantic categories (Added / Changed / Fixed …) that map 1:1 from
Conventional Commit types.
for anything user-visible.

## Testing changes against consumers

Link locally and verify all consumers:

```sh
# in each consumer package
vp install
vp check
vp test
```

Then restart the TUI (`opencode2 service restart`, then relaunch `opencode2`)
and exercise the affected feature.

Check the server log for regressions:

```sh
grep -h "failed to load plugin\|opencode-plugin-kit" \
  ~/.local/share/opencode/log/opencode.log | tail -20
```

## Adding a module

1. Create `src/<module>.ts` with a one-line purpose comment at the top.
2. Export it from `src/index.ts`.
3. Document it in the README's module table.
4. Add tests in `src/<module>.test.ts` that maintain 100% coverage.
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

## Upstreaming patterns

Patterns that belong in the OpenCode platform itself are tracked in
[docs/UPSTREAM.md](docs/UPSTREAM.md) (`TRACK → PROVE → PACKAGE → SUBMIT →
ABSORB → DELETE`). If you're contributing a kit module that wraps an
undocumented platform behavior, file a row there too — the goal is to delete
it upstream, not to grow it here.
