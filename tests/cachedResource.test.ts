import { afterEach, describe, expect, test, vi } from "vitest"
import { createRoot } from "solid-js"
import { createCachedResource } from "../src/cachedResource.ts"
import { createCachedStore } from "../src/cache.ts"
import { fakeContext } from "../src/testkit.ts"

afterEach(() => {
  vi.useRealTimers()
})

/** Create the resource inside a live owner root (never disposed — the
 * resource's fetch effect must outlive creation to run). */
function inRoot<T>(make: () => T): T {
  return createRoot(() => make())
}

async function waitForData(fn: () => unknown): Promise<void> {
  await vi.waitFor(fn, { timeout: 2_000, interval: 10 })
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe("createCachedResource", () => {
  test("serves the cache as the initial value, then refetches", async () => {
    const ctx = fakeContext()
    const cache = createCachedStore<string | null>(ctx, "picks", { initial: null, staleAfterMs: 60_000 })
    cache.set("cached")

    let calls = 0
    const cached = inRoot(() =>
      createCachedResource(
        () => "s1",
        async (sid) => {
          calls++
          return `loaded:${sid}`
        },
        { cache },
      ),
    )

    // The cache value paints immediately, synchronously.
    expect(cached.data()).toBe("cached")

    await waitForData(() => expect(cached.data()).toBe("loaded:s1"))
    expect(calls).toBe(1)
    // The cache now holds the loaded value.
    expect(cache.value).toBe("loaded:s1")
  })

  test("refetch is a no-op while the cache is fresh", async () => {
    const ctx = fakeContext()
    const cache = createCachedStore<string | null>(ctx, "picks", { initial: null, staleAfterMs: 60_000 })
    let calls = 0
    const cached = inRoot(() =>
      createCachedResource(
        () => "s1",
        async () => {
          calls++
          return "v"
        },
        { cache },
      ),
    )
    await waitForData(() => expect(calls).toBe(1))
    cached.refetch()
    await sleep(20)
    expect(calls).toBe(1)
  })

  test("refetch reloads when the cache is stale", async () => {
    const ctx = fakeContext()
    const cache = createCachedStore<string | null>(ctx, "picks", { initial: null, staleAfterMs: 50 })
    let calls = 0
    const cached = inRoot(() =>
      createCachedResource(
        () => "s1",
        async () => {
          calls++
          return `v${calls}`
        },
        { cache },
      ),
    )
    await waitForData(() => expect(calls).toBe(1))
    // Let the cache go stale, then force a refetch.
    await sleep(60)
    cached.refetch()
    await waitForData(() => expect(calls).toBe(2))
    expect(cache.value).toBe("v2")
  })

  test("refetchNow bypasses the staleness gate", async () => {
    const ctx = fakeContext()
    const cache = createCachedStore<string | null>(ctx, "picks", { initial: null, staleAfterMs: 60_000 })
    let calls = 0
    const cached = inRoot(() =>
      createCachedResource(
        () => "s1",
        async () => {
          calls++
          return `v${calls}`
        },
        { cache },
      ),
    )
    await waitForData(() => expect(calls).toBe(1))
    // Cache is fresh, yet refetchNow forces the reload.
    cached.refetchNow()
    await waitForData(() => expect(calls).toBe(2))
    expect(cache.value).toBe("v2")
  })

  test("set updates both the resource and the cache", async () => {
    const ctx = fakeContext()
    const cache = createCachedStore<string | null>(ctx, "picks", { initial: null, staleAfterMs: 60_000 })
    const cached = inRoot(() =>
      createCachedResource(
        () => "s1",
        async () => "initial",
        { cache },
      ),
    )
    await waitForData(() => expect(cached.data()).toBe("initial"))
    cached.set("manual")
    expect(cache.value).toBe("manual")
    expect(cached.data()).toBe("manual")
  })

  test("passes the source value through to the loader", async () => {
    const ctx = fakeContext()
    const cache = createCachedStore<string | null>(ctx, "picks", { initial: null, staleAfterMs: 60_000 })
    let seen: string | undefined = "sentinel"
    const cached = inRoot(() =>
      createCachedResource(
        () => "s2",
        async (sid) => {
          seen = sid
          return "v"
        },
        { cache },
      ),
    )
    await waitForData(() => expect(cached.data()).toBe("v"))
    expect(seen).toBe("s2")
  })

  test("an undefined source never triggers the loader", async () => {
    const ctx = fakeContext()
    const cache = createCachedStore<string | null>(ctx, "picks", { initial: null, staleAfterMs: 60_000 })
    let calls = 0
    const cached = inRoot(() =>
      createCachedResource(
        () => undefined,
        async () => {
          calls++
          return "v"
        },
        { cache },
      ),
    )
    await sleep(30)
    expect(calls).toBe(0)
    expect(cached.data()).toBeUndefined()
  })
})
