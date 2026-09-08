import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { createCachedStore } from "./cache.ts"
import { fakeContext, fakeStorage } from "./testkit.ts"

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(10_000)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("createCachedStore", () => {
  test("starts with the initial value and reports stale", () => {
    const cache = createCachedStore<string | null>(fakeContext(), "k", { initial: "a", staleAfterMs: 100 })
    expect(cache.value).toBe("a")
    expect(cache.lastSet).toBe(0)
    expect(cache.stale).toBe(true)
  })

  test("set updates value, timestamp and staleness", () => {
    const cache = createCachedStore<string | null>(fakeContext(), "k", { initial: null, staleAfterMs: 100 })
    cache.set("x")
    expect(cache.value).toBe("x")
    expect(cache.lastSet).toBe(10_000)
    expect(cache.stale).toBe(false)

    vi.advanceTimersByTime(101)
    expect(cache.stale).toBe(true)
  })

  test("restores the persisted entry on construction", () => {
    const ctx = fakeContext()
    ;(ctx as { storage: unknown }).storage = fakeStorage({ k: { entry: { value: "saved", at: 5_000 } } })
    const cache = createCachedStore(ctx, "k", { initial: null, staleAfterMs: 100 })
    expect(cache.value).toBe("saved")
    expect(cache.lastSet).toBe(5_000)
    expect(cache.stale).toBe(true) // 5000 is older than the fake now (10000) + 100
  })

  test("falls back to memory-only when storage throws", () => {
    const ctx = fakeContext()
    ;(ctx as { storage: unknown }).storage = {
      store: () => {
        throw new Error("no storage")
      },
    }
    const cache = createCachedStore(ctx, "k", { initial: "mem", staleAfterMs: 100 })
    expect(cache.value).toBe("mem")
    cache.set("next")
    expect(cache.value).toBe("next")
    expect(cache.lastSet).toBe(10_000)
  })

  test("keeps the stale check exact at the boundary", () => {
    const cache = createCachedStore(fakeContext(), "k", { initial: 1, staleAfterMs: 50 })
    cache.set(2)
    vi.advanceTimersByTime(49)
    expect(cache.stale).toBe(false)
    vi.advanceTimersByTime(2)
    expect(cache.stale).toBe(true)
  })
})
