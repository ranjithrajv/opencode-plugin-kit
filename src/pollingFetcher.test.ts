import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { createPollingFetcher } from "./pollingFetcher.ts"

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

/** Advance N interval ticks without running the timer queue forever. */
async function ticks(ms: number) {
  await vi.advanceTimersByTimeAsync(ms)
}

describe("createPollingFetcher", () => {
  test("fetches immediately and again on the interval", async () => {
    const fetch = vi.fn(() => Promise.resolve("v"))
    const onResult = vi.fn()
    const pf = createPollingFetcher({ fetch, intervalMs: 1_000, onResult })

    await ticks(0)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(onResult).toHaveBeenCalledWith("v")

    await ticks(1_000)
    expect(fetch).toHaveBeenCalledTimes(2)

    pf.stop()
    await ticks(10_000)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  test("skips null results without calling onResult", async () => {
    const onResult = vi.fn()
    const pf = createPollingFetcher({ fetch: () => Promise.resolve(null), intervalMs: 1_000, onResult })
    await ticks(0)
    expect(onResult).not.toHaveBeenCalled()
    pf.stop()
  })

  test("keeps the last value when a fetch returns null", async () => {
    let value: string | null = "first"
    const onResult = vi.fn()
    const pf = createPollingFetcher({ fetch: () => Promise.resolve(value), intervalMs: 1_000, onResult })
    await ticks(0)
    expect(onResult).toHaveBeenCalledTimes(1)

    value = null
    await ticks(1_000)
    expect(onResult).toHaveBeenCalledTimes(1)
    pf.stop()
  })

  test("reports errors via onError and keeps polling", async () => {
    const onError = vi.fn()
    let fail = true
    const pf = createPollingFetcher({
      fetch: () => (fail ? Promise.reject(new Error("boom")) : Promise.resolve("ok")),
      intervalMs: 1_000,
      onError,
    })
    await ticks(0)
    expect(onError).toHaveBeenCalledTimes(1)

    fail = false
    await ticks(1_000)
    expect(onError).toHaveBeenCalledTimes(1)
    pf.stop()
  })

  test("throttles manual refresh calls", async () => {
    const fetch = vi.fn(() => Promise.resolve("v"))
    const pf = createPollingFetcher({ fetch, intervalMs: 10_000, throttleMs: 5_000 })
    await ticks(0)
    expect(fetch).toHaveBeenCalledTimes(1)

    pf.refresh()
    await ticks(1_000)
    expect(fetch).toHaveBeenCalledTimes(1) // throttled

    vi.advanceTimersByTime(5_001)
    pf.refresh()
    await ticks(0)
    expect(fetch).toHaveBeenCalledTimes(2)
    pf.stop()
  })

  test("refresh during an in-flight fetch is ignored", async () => {
    let release!: (v: string) => void
    const gate = new Promise<string>((resolve) => (release = resolve))
    const fetch = vi.fn(() => gate)
    const onResult = vi.fn()
    const pf = createPollingFetcher({ fetch, intervalMs: 10_000, throttleMs: 0, onResult })

    // First fetch is in flight right after construction.
    expect(pf.inFlight()).toBe(true)
    pf.refresh() // hits the in-flight guard in doFetch
    release("done")
    await ticks(0)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(onResult).toHaveBeenCalledWith("done")
    expect(pf.inFlight()).toBe(false)
    pf.stop()
  })

  test("inFlight clears once the fetch resolves", async () => {
    const pf = createPollingFetcher({ fetch: () => Promise.resolve(null), intervalMs: 1_000 })
    expect(pf.inFlight()).toBe(true)
    await ticks(0)
    expect(pf.inFlight()).toBe(false)
    pf.stop()
  })

  test("stop clears the interval timer even when called twice", async () => {
    const fetch = vi.fn(() => Promise.resolve("v"))
    const pf = createPollingFetcher({ fetch, intervalMs: 1_000 })
    await ticks(0)
    pf.stop()
    pf.stop()
    await ticks(5_000)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  test("defaults throttleMs to intervalMs", async () => {
    const fetch = vi.fn(() => Promise.resolve("v"))
    const pf = createPollingFetcher({ fetch, intervalMs: 1_000 })
    await ticks(0)
    pf.refresh()
    await ticks(0)
    expect(fetch).toHaveBeenCalledTimes(1)
    pf.stop()
  })
})
