import { afterEach, describe, expect, test, vi } from "vitest"
import { createHostEvents } from "../src/hostEvents.ts"

function context(overrides: Record<string, unknown> = {}) {
  return { data: { ...(overrides as object) } } as never
}

afterEach(() => {
  vi.useRealTimers()
})

describe("createHostEvents", () => {
  test("subscribes to known events and heartbeats slowly while live", () => {
    vi.useFakeTimers()
    const onEvent = vi.fn()
    const offs: Array<ReturnType<typeof vi.fn>> = []
    const ctx = context({
      on: (type: string, handler: () => void) => {
        expect(handler).toBe(onEvent)
        expect(type).toMatch(/^session\./)
        const off = vi.fn()
        offs.push(off)
        return off
      },
    })
    const events = createHostEvents(ctx, { types: ["session.status", "session.idle"], onEvent })
    expect(events.live()).toBe(true)
    vi.advanceTimersByTime(10_000)
    expect(onEvent).toHaveBeenCalledTimes(1)
    events.stop()
    expect(offs).toHaveLength(2)
    for (const off of offs) expect(off).toHaveBeenCalledOnce()
  })

  test("falls back to a fast heartbeat when the host has no events", () => {
    vi.useFakeTimers()
    const onEvent = vi.fn()
    const events = createHostEvents(context(), { types: ["session.status"], onEvent })
    expect(events.live()).toBe(false)
    vi.advanceTimersByTime(1000)
    expect(onEvent).toHaveBeenCalledTimes(1)
    events.stop()
  })

  test("skips events the host rejects and non-function unsubscribes", () => {
    vi.useFakeTimers()
    const onEvent = vi.fn()
    const ctx = context({
      on: (type: string) => {
        if (type === "boom") throw new Error("unknown")
        if (type === "nofn") return undefined
        return () => {}
      },
    })
    const events = createHostEvents(ctx, { types: ["boom", "nofn"], onEvent })
    expect(events.live()).toBe(false)
    vi.advanceTimersByTime(500)
    expect(onEvent).not.toHaveBeenCalled()
    events.stop()
  })

  test("honors custom intervals and makes stop idempotent", () => {
    vi.useFakeTimers()
    const onEvent = vi.fn()
    const ctx = context({ on: () => () => {} })
    const events = createHostEvents(ctx, { types: ["x"], onEvent, heartbeatMs: 5000 })
    vi.advanceTimersByTime(5000)
    expect(onEvent).toHaveBeenCalledTimes(1)

    const fallback = createHostEvents(context(), { types: ["x"], onEvent, fallbackMs: 250 })
    vi.advanceTimersByTime(250)
    expect(onEvent).toHaveBeenCalledTimes(2)

    events.stop()
    events.stop()
    fallback.stop()
    vi.advanceTimersByTime(100_000)
    expect(onEvent).toHaveBeenCalledTimes(2)
  })
})
