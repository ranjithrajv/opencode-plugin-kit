import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { createRoot } from "solid-js"
import { createConnectedProviders } from "./connectedProviders.ts"

vi.mock("./providers.ts", () => ({
  hasKey: (id: string) => id === "known-key",
}))
import { fakeContext } from "./testkit.ts"

beforeEach(() => {
  vi.useFakeTimers()
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

describe("createConnectedProviders", () => {
  test("reads the integration list and merges extras", async () => {
    const ctx = fakeContext()
    ctx.client.integration.list = vi.fn(() =>
      Promise.resolve({ data: [{ id: "opencode", connections: [{ type: "key" }] }] }),
    )
    const cp = createRoot((dispose) => {
      const c = createConnectedProviders(ctx, { extra: ["google"], pollMs: 0 })
      queueMicrotask(dispose)
      return c
    })
    await flush()
    expect(cp.ids()).toEqual(new Set(["opencode", "google"]))
    expect(cp.has("opencode")).toBe(true)
    expect(cp.has("opencode-go")).toBe(false)
  })

  test("supports a function extra provider", async () => {
    const ctx = fakeContext()
    process.env.HF_TOKEN = "hf"
    const cp = createRoot((dispose) => {
      const c = createConnectedProviders(ctx, { extra: () => (process.env.HF_TOKEN ? ["huggingface"] : []), pollMs: 0 })
      queueMicrotask(dispose)
      return c
    })
    await flush()
    expect(cp.has("huggingface")).toBe(true)
  })

  test("falls back to auth.json-backed extras when the client throws", async () => {
    const ctx = fakeContext()
    ctx.client.integration.list = vi.fn(() => Promise.reject(new Error("no client")))
    const cp = createRoot((dispose) => {
      // "known-key" has a key (mocked hasKey), "unknown" does not.
      const c = createConnectedProviders(ctx, { extra: () => ["known-key", "unknown"], pollMs: 0 })
      queueMicrotask(dispose)
      return c
    })
    await flush()
    expect(cp.ids()).toEqual(new Set(["known-key"]))
  })

  test("no extras are connected when the client throws and extras is absent", async () => {
    const ctx = fakeContext()
    ctx.client.integration.list = vi.fn(() => Promise.reject(new Error("no client")))
    const cp = createRoot((dispose) => {
      const c = createConnectedProviders(ctx, { pollMs: 0 })
      queueMicrotask(dispose)
      return c
    })
    await flush()
    expect(cp.ids().size).toBe(0)
  })

  test("polls on the interval and refresh() forces an immediate poll", async () => {
    const ctx = fakeContext()
    let result = { data: [] as unknown[] }
    ctx.client.integration.list = vi.fn(() => Promise.resolve(result))
    const cp = createRoot((_dispose) => {
      const c = createConnectedProviders(ctx, { pollMs: 1_000 })
      return c
    })
    await flush()
    expect(ctx.client.integration.list).toHaveBeenCalledTimes(1)

    result = { data: [{ id: "opencode-go", connections: [{ type: "key" }] }] }
    await vi.advanceTimersByTimeAsync(1_000)
    expect(ctx.client.integration.list).toHaveBeenCalledTimes(2)
    expect(cp.has("opencode-go")).toBe(true)

    await cp.refresh()
    expect(ctx.client.integration.list).toHaveBeenCalledTimes(3)
  })

  test("stop() cancels polling", async () => {
    const ctx = fakeContext()
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
    const ctx = fakeContext()
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
    const ctx = fakeContext()
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
