# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- Structural host types (`host.ts`) — `KitContext`, `KitMessageShape`
- 156 tests across 12 test files
- Vite+ developer tooling (format, lint, typecheck)
- GitHub Actions CI
- Pre-commit hooks via `vp staged`

[Unreleased]: https://github.com/ranjithraj/opencode-plugin-kit/compare/v0.1.0...HEAD
