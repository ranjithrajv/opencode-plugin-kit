# Host compatibility

The kit supports `@opencode/plugin` **^2.0.3**.
Each row is a published host build the kit is verified against, by two
independent checks:

- **Type** — the contract tripwire (`tests/host.test-d.ts`): the host's published
  types still satisfy every shape the kit consumes. Drift fails with a diff.
- **Runtime** — the runtime smoke (`tests/runtime-smoke.test.ts`): the real host
  runtime imports, and every kit factory executes against a host-shaped context.
  This catches what types cannot — a missing dependency, a broken JSX pragma, a
  throw the type checker never sees.

| `@opencode/plugin` | Type | Runtime |
| ------------------ | :--: | :-----: |
| `2.0.3` | ✅ | ✅ |
| `2.0.10` | ✅ | ✅ |
| `2.0.15` | ✅ | ✅ |
| `2.0.18` | ✅ | ✅ |

- **Floor:** `2.0.3` — earlier 2.x ships no `./tui` subpath export.
- **Pinned for development:** `2.0.15`.
- Builds outside this table are untested; the `^2.0.3` peer range is the promise,
  this table is the evidence.
- Regenerate: `npm run check:host-compat -- --write-matrix`
- Runs in CI ([host-compat.yml](../.github/workflows/host-compat.yml)) on every
  change, and gates every release.

This file is generated and byte-stable on purpose: CI regenerates it and fails
on any diff, so it cannot silently drift from what the checks actually observed.
