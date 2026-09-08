import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { createRoot } from "solid-js"
import { createConnectedProviders } from "../src/providers.ts"

const AUTH_PATH = "/tmp/opencode/fakehome/.local/share/opencode/auth.json"

vi.mock("node:os", () => ({ homedir: () => "/tmp/opencode/fakehome" }))

const fsState: { content: string; throws: boolean } = { content: "{}", throws: false }

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>()
  return {
    ...actual,
    readFileSync: (path: unknown) => {
      if (path === AUTH_PATH) {
        if (fsState.throws) throw new Error("boom")
        return fsState.content
      }
      throw new Error(`unexpected read: ${String(path)}`)
    },
  }
})

beforeEach(() => {
  vi.useFakeTimers()
  fsState.content = "{}"
  fsState.throws = false
  delete process.env.HF_TOKEN
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function flush(): Promise<void> {
  // Microtask-only flush: safe under vi.useFakeTimers().
  let p: Promise<unknown> = Promise.resolve()
  for (let i = 0; i < 10; i++) p = p.then(() => {})
  return p as Promise<void>
}

/** Reset the module graph so availableProviders()'s memo re-reads auth.json
 * under the current fsState (the memo is module-scoped). */
async function freshProviders() {
  vi.resetModules()
  return import("../src/providers.ts")
}

describe("createConnectedProviders", () => {
  test("reads the integration list", async () => {
    const ctx = fakeContextWith({
      data: [{ id: "opencode", connections: [{ type: "key" }] }],
    })
    const cp = createRoot((dispose) => {
      const c = createConnectedProviders(ctx, { pollMs: 0 })
      queueMicrotask(dispose)
      return c
    })
    await flush()
    expect(cp.ids()).toEqual(new Set(["opencode"]))
    expect(cp.has("opencode")).toBe(true)
    expect(cp.has("opencode-go")).toBe(false)
  })

  test("unions in huggingface when HF_TOKEN is set", async () => {
    process.env.HF_TOKEN = "hf"
    const ctx = fakeContextWith({ data: [] })
    const cp = createRoot((dispose) => {
      const c = createConnectedProviders(ctx, { pollMs: 0 })
      queueMicrotask(dispose)
      return c
    })
    await flush()
    expect(cp.has("huggingface")).toBe(true)
  })

  test("falls back to auth.json-based discovery when the client throws", async () => {
    fsState.content = JSON.stringify({ opencode: { key: "k" }, google: { key: "g" } })
    const { createConnectedProviders: freshCreate } = await freshProviders()
    const ctx = fakeContextWith({ throws: true })
    const cp = createRoot((dispose) => {
      const c = freshCreate(ctx, { pollMs: 0 })
      queueMicrotask(dispose)
      return c
    })
    await flush()
    expect(cp.ids()).toEqual(new Set(["opencode", "google"]))
  })

  test("fallback includes huggingface via HF_TOKEN even when auth.json is unreadable", async () => {
    process.env.HF_TOKEN = "hf"
    fsState.throws = true
    const { createConnectedProviders: freshCreate } = await freshProviders()
    const ctx = fakeContextWith({ throws: true })
    const cp = createRoot((dispose) => {
      const c = freshCreate(ctx, { pollMs: 0 })
      queueMicrotask(dispose)
      return c
    })
    await flush()
    // auth.json unreadable -> Zen + Go fallback, plus the env provider.
    expect(cp.has("opencode")).toBe(true)
    expect(cp.has("opencode-go")).toBe(true)
    expect(cp.has("huggingface")).toBe(true)
  })

  test("polls on the interval and refresh() forces an immediate poll", async () => {
    const ctx = fakeContextWith({ data: [] })
    const cp = createRoot((_dispose) => {
      const c = createConnectedProviders(ctx, { pollMs: 1_000 })
      return c
    })
    await flush()
    expect(ctx.client.integration.list).toHaveBeenCalledTimes(1)

    fakeListResult.data = [{ id: "opencode-go", connections: [{ type: "key" }] }]
    await vi.advanceTimersByTimeAsync(1_000)
    expect(ctx.client.integration.list).toHaveBeenCalledTimes(2)
    expect(cp.has("opencode-go")).toBe(true)

    await cp.refresh()
    expect(ctx.client.integration.list).toHaveBeenCalledTimes(3)
  })

  test("stop() cancels polling", async () => {
    const ctx = fakeContextWith({ data: [] })
    const cp = createRoot((_dispose) => {
      const c = createConnectedProviders(ctx, { pollMs: 1_000 })
      return c
    })
    await flush()
    cp.stop()
    const calls = vi.mocked(ctx.client.integration.list).mock.calls.length
    await vi.advanceTimersByTimeAsync(10_000)
    expect(ctx.client.integration.list).toHaveBeenCalledTimes(calls)
  })

  test("no polling when pollMs is 0", async () => {
    const ctx = fakeContextWith({ data: [] })
    const cp = createRoot((dispose) => {
      const c = createConnectedProviders(ctx, { pollMs: 0 })
      queueMicrotask(dispose)
      return c
    })
    await flush()
    const calls = vi.mocked(ctx.client.integration.list).mock.calls.length
    await vi.advanceTimersByTimeAsync(60_000)
    expect(ctx.client.integration.list).toHaveBeenCalledTimes(calls)
    cp.stop()
  })

  test("defaults to a 30s poll interval", async () => {
    const ctx = fakeContextWith({ data: [] })
    const cp = createRoot((_dispose) => {
      const c = createConnectedProviders(ctx, {})
      return c
    })
    await flush()
    await cp.refresh()
    expect(ctx.client.integration.list).toHaveBeenCalledTimes(2)
    cp.stop()
  })
})

// ---------------------------------------------------------------------------
// Fake context plumbing
// ---------------------------------------------------------------------------

import { fakeContext } from "../src/testkit.ts"

/** Mutable list result so polling tests can flip it between polls. */
let fakeListResult: { data: unknown[]; throws?: boolean }

function fakeContextWith(opts: { data?: unknown[]; throws?: boolean }) {
  fakeListResult = { data: opts.data ?? [], throws: opts.throws }
  const ctx = fakeContext()
  ctx.client.integration.list = vi.fn(() => {
    if (fakeListResult.throws) return Promise.reject(new Error("no client"))
    return Promise.resolve({ data: fakeListResult.data })
  })
  return ctx
}
