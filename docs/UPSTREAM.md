# Upstream pipeline

How kit patterns graduate into the official OpenCode plugin API — and how the
kit shrinks as they do. Absorption is the exit goal: every helper deleted
here is maintenance we no longer own (see README's philosophy).

## Pipeline stages

```
 TRACK → PROVE → PACKAGE → SUBMIT → ABSORB → DELETE
```

| Stage       | Meaning                                                                                                 | Artifact                      |
| ----------- | ------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **TRACK**   | Pattern identified in the kit; logged below with status                                                 | A row in this file            |
| **PROVE**   | Reproduced the gap independently of our code (minimal repro or doc reference)                           | Gist / repro repo             |
| **PACKAGE** | Written as an upstream-sized proposal: issue text, docs patch, or API sketch — not a link dump          | Draft PR or issue             |
| **SUBMIT**  | Opened against `sst/opencode` (docs PRs go to `packages/www/src/docs/content/`)                         | Issue/PR number, logged below |
| **ABSORB**  | Merged upstream (docs fix, new primitive, behavior change)                                              | Release note reference        |
| **DELETE**  | Kit code removed; consumers switched to the native API; kit version bumped major if the surface changed | Changelog entry               |

Rules:

- One pattern per issue/PR. Upstream maintainers merge focused changes.
- Every SUBMIT gets the issue/PR number recorded here so status is auditable.
- Nothing is deleted from the kit until the absorbing OpenCode release is
  what consumers actually pin (`@opencode-ai/plugin` `beta` moves fast; check
  the installed version, not the latest changelog).

## Candidate queue

Status legend: `tracked → proved → packaged → submitted → absorbed → deleted`

### 1. Keymap layers silently no-op from `setup()` — docs bug

- **Status:** tracked
- **Gap:** `context.keymap.layer()` only activates when called from a
  rendered component (the `app`-slot trick). The CLI plugin docs' own
  `session.panel` example shows the workaround but never states the rule.
  Every new plugin author hits this blind.
- **Upstream ask:** one paragraph + warning box in
  `/v2/docs/build/plugins/cli`; optionally a dev-mode warn when `layer()` is
  called with no owning component.
- **Size:** docs PR (small). **Do first** — cheap, high-signal.

### 2. View-picker-over-registry — feature proposal

- **Status:** tracked
- **Gap:** "register a command that opens `dialog.select` over a registry,
  persists the choice, toasts on switch" is the shape of two plugins already;
  there is no native `ui.picker`-style primitive combining slot + keymap +
  dialog + storage.
- **Upstream ask:** an API sketch for `context.ui.picker({ options, current,
onChange, persist })` or `context.commands.registerView()` — reference
  implementation is `viewPicker.ts`.
- **Size:** API design discussion. Submit the issue after #1 lands (credibility).

### 3. Slot render reactivity contract — docs clarification

- **Status:** tracked
- **Gap:** "render receives the slot's input, reactively" is one line in the
  types. Which signal reads subscribe, when re-renders fire, and that plain
  JS variables never trigger renders are all undocumented — it cost us the
  `/usage-view` dead-toggle bug.
- **Upstream ask:** short section in the CLI plugin guide; a table of slot
  paths and their reactive inputs already exists in `SlotMap` — link it.
- **Size:** docs PR (small).

### 4. Connected-provider discovery — feature proposal (small)

- **Status:** tracked
- **Gap:** plugins that gate on connected providers must read
  `client.integration.list()` (undocumented shape) or scrape
  `auth.json` (private file). `connections.length > 0` is a load-bearing
  convention with no contract.
- **Upstream ask:** either document `/api/integration`'s connection semantics
  in the API docs, or add `context.data.provider.connected()`.
- **Size:** docs-first; API ask only if docs reveal the shape is stable.

### 5. Boundary-shape stability (`/api/integration`, usage endpoint)

- **Status:** tracked
- **Gap:** our `schemas.ts` exists because these shapes are undocumented and
  silently changeable. Even just an OpenAPI entry for the usage endpoint lets
  us delete half the schema layer.
- **Upstream ask:** follow-up to #4; include our Zod schemas as the proposed
  published types.
- **Size:** medium; dependent on #4.

### 6. `bar()` / row formatting — **do not upstream**

- Deliberately plugin-domain (visual choice). Keep in kit.

## Cadence

- **Quarterly pass:** re-read `docs/opencode2-api.md` against the current
  OpenAPI spec and plugin docs; promote/demote candidates; check whether
  submitted items were absorbed silently (grep the plugin API changelog).
- **Per release of the kit:** re-run the consumers against the installed
  `@opencode-ai/plugin` version before bumping; a failed typecheck upstream
  is an early absorption signal in reverse.

## Absorbed log

| Pattern      | Absorbed in | Kit code deleted |
| ------------ | ----------- | ---------------- |
| _(none yet)_ |             |                  |
