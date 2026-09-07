# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-09-07

### Added

- Provider vocabulary (`providers.ts`): Zen/Go provider ids, `providerLabel`,
  connected-provider discovery, and defensive beta-API shape helpers
  (`unwrap`, `asArray`, `modelId`, `providerId`).
- Sidebar row formatting (`rows.ts`): `short()` id truncation, padded
  `label id (provider) value` lines with configurable width, `bar()` progress bar.
- Number/date formatting (`format.ts`): `fmt()`, `fmtCost()`, `until()` reset countdowns.
- Persisted view/filter picker (`viewPicker.ts`): registry, durable selection
  via plugin storage, slash/palette command (keymap layer in `app` slot),
  `dialog.select` picker, toast, and `selectable`/`unavailableMessage` gating.
- Contributor docs: `CONTRIBUTING.md` (what belongs in the kit) and
  `docs/opencode2-api.md` (API cheat-sheet).

Initial consumers: [opencode-usage-quota-tracker](../opencode-usage-quota-tracker),
[opencode-model-recommender](../opencode-model-recommender).

[0.1.0]: https://github.com/ranjithraj/opencode-plugin-kit/releases/tag/v0.1.0
