// Runtime smoke test.
//
// The type-tripwire (`host.test-d.ts`) proves the host's *types* still match
// what kit consumes. It cannot prove the kit's modules actually *load and run*
// against an installed host build — that is the class of failure that has hurt
// this project before (the missing JSX pragma, the collapsible context lookup).
//
// This test imports the real `@opencode/plugin/tui` runtime, imports every kit
// module through the package root, and calls each factory against a host-shaped
// context. It catches import-time breakage and factory-time throws that static
// checking misses. `scripts/check-host-compat.mjs` runs this same file against
// several pinned `@opencode/plugin` versions.
import { describe, expect, test } from "vitest"
import { createRoot } from "solid-js"
import { readFileSync } from "node:fs"
import * as kitNamespace from "../src/index.ts"

const kit = kitNamespace as unknown as Record<string, unknown>

/** The `@opencode/plugin` build this smoke run is exercising. */
function installedHostVersion(): string {
  try {
    const url = new URL("../node_modules/@opencode/plugin/package.json", import.meta.url)
    const pkg = JSON.parse(readFileSync(url, "utf8")) as { version?: string }
    return pkg.version ?? "unknown"
  } catch {
    return "unknown"
  }
}

/** A host context that satisfies every surface kit reads, optional ones included. */
function smokeContext(): Record<string, unknown> {
  const slots: Array<Record<string, unknown>> = []
  const toasts: unknown[] = []
  return {
    storage: {
      store: (_key: string, { initial }: { initial: unknown }) => [initial, initial],
      memory: (_key: string, { initial }: { initial: unknown }) => [initial, () => {}],
    },
    ui: {
      toast: { show: (t: unknown) => toasts.push(t) },
      dialog: { alert: async () => {}, select: async () => undefined },
      slot: (options: Record<string, unknown>) => {
        slots.push(options)
        return () => {}
      },
      panel: { open: () => true, close: () => {}, current: () => undefined },
      router: { register: () => () => {}, navigate: () => {}, current: () => ({ type: "home" }) },
      tabs: {
        enabled: () => true,
        list: () => [],
        open: () => true,
        focus: () => true,
        move: () => true,
        close: () => true,
      },
    },
    keymap: { layer: () => {} },
    data: {
      session: { message: { list: () => [] }, list: () => [] },
      on: () => () => {},
    },
    client: { integration: { list: async () => ({ data: [] }) } },
    // Not part of KitContext yet, but read defensively by attention.ts.
    attention: { notify: async () => ({ ok: true, notification: true, sound: true }) },
  }
}

const documentedExports = [
  // provider vocabulary + shape readers
  "providerLabel",
  "availableProviders",
  "createConnectedProviders",
  "unwrap",
  "isAssistant",
  "asArray",
  "modelId",
  "providerId",
  "readAuth",
  "hasKey",
  "authKeys",
  // formatting
  "short",
  "line",
  "bar",
  "fmt",
  "fmtCost",
  "until",
  "compactNumber",
  "formatCost",
  "formatDuration",
  "formatClock",
  "formatDelta",
  "formatPercent",
  "shortPath",
  "truncate",
  // theme / util
  "toneColor",
  "safe",
  // tokens
  "tokenBreakdown",
  "messageCost",
  "estimateTokens",
  // state
  "createCachedStore",
  "persistedCell",
  "createPersistedState",
  // schemas
  "parseUsage",
  "parseIntegrationList",
  "connectedProviderIds",
  // ui patterns
  "createViewPicker",
  "createToggle",
  "registerKeymapCommand",
  "registerKeymapLayer",
  "claimSlot",
  "createPanel",
  "showToast",
  "createHostEvents",
  "createStatusbar",
  "createComposer",
  "createTabs",
  "createPage",
  "navigateTo",
  "currentRoute",
  "requestAttention",
  "notifyTaskComplete",
  "notifyError",
  "paletteCommand",
  "registerPaletteCommand",
  "registerPaletteGroup",
  "dynamicPaletteCommand",
  // data
  "resolveCurrentModel",
  "createCachedResource",
  "walkMessages",
  "sumProviderTokens",
  "cacheReadInput",
  "createPollingFetcher",
  "createMessageIndex",
  "messageFingerprint",
  // workspace / catalog
  "resolveLocation",
  "workspaceDirectory",
  "listSkillCatalog",
  "syncSkillCatalog",
  "readSkillCatalog",
  "findAgentsMd",
  // config
  "tolerantParse",
  "cleanJsonc",
  "addPluginSpec",
  "addPluginsKey",
  "removePluginSpec",
  "editPluginsText",
  // layout
  "budgetFor",
  "compactFor",
  "columnFor",
] as const

describe("runtime smoke", () => {
  test("imports the installed @opencode/plugin runtime build", async () => {
    const host = await import("@opencode/plugin/tui")
    expect(installedHostVersion()).not.toBe("unknown")
    expect(typeof host.Plugin?.define).toBe("function")
    // `define()` is an identity function over the plugin definition.
    const definition = { id: "smoke", setup: () => {} }
    expect(host.Plugin.define(definition)).toBe(definition)
  })

  test("exposes every documented export at runtime", () => {
    const missing = documentedExports.filter((name) => kit[name] === undefined)
    expect(missing).toEqual([])
    const wrongType = documentedExports.filter((name) => typeof kit[name] !== "function")
    expect(wrongType).toEqual([])
  })

  test("factories run against a host-shaped context without throwing", async () => {
    const context = smokeContext()
    const results = createRoot((dispose) => {
      const out: Record<string, unknown> = {}
      const call = (name: string, fn: () => unknown) => {
        expect(() => (out[name] = fn()), `${name} threw`).not.toThrow()
      }

      call("claimSlot", () => (kit.claimSlot as any)(context, { append: "sidebar.footer", render: () => null }))
      call("createStatusbar", () => (kit.createStatusbar as any)(context, { slot: "home.footer", render: () => null }))
      call("createComposer", () => (kit.createComposer as any)(context, { render: () => null }))
      call("createPanel", () => (kit.createPanel as any)(context, { name: "smoke", render: () => null }))
      call("createTabs", () => (kit.createTabs as any)(context))
      call("createPage", () => (kit.createPage as any)(context, { name: "smoke", render: () => null }))
      call("createToggle", () =>
        (kit.createToggle as any)(context, {
          storageKey: "smoke.toggle",
          initial: false,
          command: { id: "smoke.toggle", group: "Smoke", name: "smoke-toggle", description: "d", title: () => "t" },
        }),
      )
      call("createViewPicker", () =>
        (kit.createViewPicker as any)(context, {
          registry: [{ id: "a", title: "A" }],
          storageKey: "smoke.view",
          command: { id: "smoke.view", group: "Smoke", name: "smoke-view", description: "d", title: () => "t" },
          dialog: { title: "T", message: "M" },
        }),
      )
      call("createCachedStore", () =>
        (kit.createCachedStore as any)(context, "smoke.cache", { initial: { n: 0 }, staleAfterMs: 1000 }),
      )
      call("createPersistedState", () => (kit.createPersistedState as any)(context, "smoke.state", { open: false }))
      call("createMessageIndex", () =>
        (kit.createMessageIndex as any)({
          since: () => 0,
          parse: (m: { ts: number }) => m,
        }),
      )
      call("registerPaletteCommand", () =>
        (kit.registerPaletteCommand as any)(context, { id: "smoke.cmd", title: "Smoke", run: () => {} }),
      )
      call("registerPaletteGroup", () =>
        (kit.registerPaletteGroup as any)(context, {
          group: "Smoke",
          commands: [{ id: "smoke.1", title: "One", run: () => {} }],
        }),
      )
      call("showToast", () => (kit.showToast as any)(context, "smoke"))

      // Timer-backed factories: stop them so the run doesn't hang.
      call("createHostEvents", () => {
        const events = (kit.createHostEvents as any)(context, { types: ["smoke"], onEvent: () => {} })
        events.stop()
        return events
      })
      call("createConnectedProviders", () => {
        const connected = (kit.createConnectedProviders as any)(context, { pollMs: 0 })
        connected.stop()
        return connected
      })
      call("createPollingFetcher", () => {
        const fetcher = (kit.createPollingFetcher as any)({
          fetch: async () => null,
          intervalMs: 0,
          throttleMs: 0,
          onResult: () => {},
          onError: () => {},
        })
        fetcher.stop()
        return fetcher
      })

      dispose()
      return out
    })

    // Spot-check a few shapes rather than just "did not throw".
    expect((results.createStatusbar as { cleanup: unknown }).cleanup).toBeTypeOf("function")
    expect((results.createTabs as { enabled: () => boolean }).enabled()).toBe(true)
    expect((results.createCachedStore as { value: { n: number } }).value).toEqual({ n: 0 })

    // Async surfaces resolve without rejecting.
    const attention = await (kit.requestAttention as any)(context, { message: "smoke" })
    expect(typeof attention.ok).toBe("boolean")
    expect(typeof (await (kit.notifyTaskComplete as any)(context, "smoke")).ok).toBe("boolean")
    expect(typeof (await (kit.notifyError as any)(context, "smoke")).ok).toBe("boolean")
  })

  test("pure helpers behave on representative input", () => {
    expect(typeof (kit.tolerantParse as any)('{ /* c */ "a": 1, }')).toBe("object")
    expect((kit.tolerantParse as any)("not json")).toBeUndefined()
    expect((kit.unwrap as any)({ info: { id: "x" } })).toEqual({ id: "x" })
    expect((kit.asArray as any)({ data: [1, 2] })).toEqual([1, 2])
    expect(typeof (kit.safe as any)(() => 42)).toBe("number")
    expect(
      (kit.safe as any)(() => {
        throw new Error("boom")
      }),
    ).toBeUndefined()
    expect((kit.fmt as any)(1234)).toBeTruthy()
    expect((kit.formatPercent as any)(0.27)).toBe("27%")
  })
})
