import { afterEach, describe, expect, test, vi } from "vitest"
import { createMessageIndex, messageFingerprint } from "../src/messageIndex.ts"

interface Entry {
  ts: number
  value: number
}

function ctx(sessions: () => unknown, messages: (sid: string) => unknown) {
  return {
    data: {
      session: {
        list: sessions,
        message: { list: (sid: string) => messages(sid) },
      },
    },
  } as never
}

function assistant(value: number, created: number) {
  return { info: { type: "assistant", id: `m${value}`, tokens: { input: value }, time: { created } } }
}

const NOW = 1_000_000

afterEach(() => {
  vi.useRealTimers()
})

describe("createMessageIndex", () => {
  test("parses assistant messages within the window and unwraps envelopes", () => {
    vi.useFakeTimers({ now: NOW })
    const index = createMessageIndex<Entry>({
      since: (now) => now - 5000,
      parse: (m, ts) => ({ ts, value: m.tokens.input }),
    })
    const context = ctx(
      () => [{ id: "a" }],
      () => [
        assistant(2, NOW - 1000),
        { type: "user", time: { created: NOW - 1000 } },
        assistant(3, NOW - 9000),
        { info: { type: "assistant", tokens: { input: 9 }, time: { created: NOW - 500 } } },
        { type: "assistant", tokens: { input: 4 } },
      ],
    )
    expect(
      index
        .scan(context)
        .map((e) => e.value)
        .sort(),
    ).toEqual([2, 9])
  })

  test("serves the same scan inside the TTL and re-scans after it", () => {
    vi.useFakeTimers({ now: NOW })
    const list = vi.fn(() => [{ id: "a" }])
    const parse = vi.fn((_m: any, ts: number) => ({ ts, value: 1 }))
    const index = createMessageIndex<Entry>({ since: (now) => now - 5000, parse, ttlMs: 1000 })
    const context = ctx(list, () => [assistant(1, NOW - 100)])
    index.scan(context)
    index.scan(context)
    expect(list).toHaveBeenCalledTimes(1)
    expect(parse).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1001)
    index.scan(context)
    expect(list).toHaveBeenCalledTimes(2)
  })

  test("keeps the previous scan when session listing throws", () => {
    vi.useFakeTimers({ now: NOW })
    const index = createMessageIndex<Entry>({ since: (now) => now - 5000, parse: (_m, ts) => ({ ts, value: 5 }) })
    let boom = false
    const context = ctx(
      () => {
        if (boom) throw new Error("down")
        return [{ id: "a" }]
      },
      () => [assistant(5, NOW - 100)],
    )
    expect(index.scan(context).map((e) => e.value)).toEqual([5])
    boom = true
    vi.advanceTimersByTime(31_000)
    expect(index.scan(context).map((e) => e.value)).toEqual([5])
  })

  test("skips sid-less sessions and forgets sessions that disappear", () => {
    vi.useFakeTimers({ now: NOW })
    const index = createMessageIndex<Entry>({ since: () => 0, parse: (_m, ts) => ({ ts, value: 1 }) })
    let sessions: unknown[] = [{ id: "a" }, null, { id: "b" }]
    const values: Record<string, unknown> = { a: [assistant(1, NOW - 100)], b: [assistant(2, NOW - 100)] }
    const context = ctx(
      () => sessions,
      (sid) => values[sid],
    )
    index.scan(context)
    expect(index.size(context)).toEqual({ sessions: 2, entries: 2 })

    // "b" is gone: it is dropped while the still-present "a" is kept.
    sessions = [{ id: "a" }]
    vi.advanceTimersByTime(31_000)
    index.scan(context)
    expect(index.size(context)).toEqual({ sessions: 1, entries: 1 })
  })

  test("reuses a session's scan while its fingerprint is unchanged", () => {
    vi.useFakeTimers({ now: NOW })
    const parse = vi.fn((_m: any, ts: number) => ({ ts, value: 1 }))
    const index = createMessageIndex<Entry>({ since: () => 0, parse })
    const messages = [assistant(1, NOW - 100), assistant(2, NOW - 50)]
    const context = ctx(
      () => [{ id: "a" }],
      () => messages,
    )
    index.scan(context)
    expect(parse).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(31_000)
    index.scan(context)
    expect(parse).toHaveBeenCalledTimes(2)
    // Touching the tail invalidates it.
    messages[1] = assistant(3, NOW - 50)
    vi.advanceTimersByTime(31_000)
    index.scan(context)
    expect(parse).toHaveBeenCalledTimes(4)
  })

  test("sweeps entries by the retain predicate", () => {
    vi.useFakeTimers({ now: NOW })
    const index = createMessageIndex<Entry>({
      since: (now) => now - 60_000,
      parse: (_m, ts) => ({ ts, value: 1 }),
      retain: (entry, now) => entry.ts >= now - 5000,
    })
    const context = ctx(
      () => [{ id: "a" }],
      () => [assistant(1, NOW - 1000), assistant(2, NOW - 30_000)],
    )
    index.scan(context)
    expect(index.size(context).entries).toBe(1)
  })

  test("reads string timestamps and skips invalid ones", () => {
    vi.useFakeTimers({ now: NOW })
    const index = createMessageIndex<Entry>({ since: () => 0, parse: (_m, ts) => ({ ts, value: 1 }) })
    const iso = new Date(NOW - 100).toISOString()
    const context = ctx(
      () => [{ id: "a" }],
      () => [
        { type: "assistant", timeCreated: iso },
        { type: "assistant", createdAt: "not a date" },
        { type: "assistant" },
      ],
    )
    expect(index.scan(context)).toHaveLength(1)
  })

  test("drops a session whose message list is unavailable", () => {
    vi.useFakeTimers({ now: NOW })
    const index = createMessageIndex<Entry>({ since: () => 0, parse: (_m, ts) => ({ ts, value: 1 }) })
    let present = true
    const context = ctx(
      () => [{ id: "a" }, { id: "b" }],
      (sid) => (sid === "a" && present ? [assistant(1, NOW - 100)] : undefined),
    )
    index.scan(context)
    expect(index.size(context)).toEqual({ sessions: 1, entries: 1 })
    present = false
    vi.advanceTimersByTime(31_000)
    index.scan(context)
    expect(index.size(context)).toEqual({ sessions: 0, entries: 0 })
  })

  test("supports a custom fingerprint, include and parse filter", () => {
    vi.useFakeTimers({ now: NOW })
    const index = createMessageIndex<Entry>({
      since: (now) => now - 5000,
      include: (m) => m.type === "assistant",
      fingerprint: (list) => String(list.length),
      parse: (m, ts) => (m.tokens.input > 0 ? { ts, value: m.tokens.input } : undefined),
    })
    const context = ctx(
      () => [{ id: "a" }],
      () => [
        { type: "assistant", tokens: { input: 7 }, time: { created: NOW - 100 } },
        { type: "assistant", tokens: { input: 0 }, time: { created: NOW - 100 } },
        { type: "user", tokens: { input: 5 }, time: { created: NOW - 100 } },
      ],
    )
    expect(index.scan(context).map((e) => e.value)).toEqual([7])
  })

  test("tolerates a host without a session list and resets cleanly", () => {
    const index = createMessageIndex<Entry>({ since: (now) => now - 5000, parse: (_m, ts) => ({ ts, value: 1 }) })
    const context = { data: {} } as never
    expect(index.scan(context)).toEqual([])
    expect(index.size(context)).toEqual({ sessions: 0, entries: 0 })

    vi.useFakeTimers({ now: NOW })
    const real = ctx(
      () => [{ id: "a" }],
      () => [assistant(1, NOW - 100)],
    )
    index.scan(real)
    expect(index.size(real).entries).toBe(1)
    index.reset()
    expect(index.size(real)).toEqual({ sessions: 0, entries: 0 })
  })
})

describe("messageFingerprint", () => {
  test("encodes length, id, created and tokens", () => {
    expect(messageFingerprint([])).toBe("0")
    expect(messageFingerprint([{ id: "m1", time: { created: 5 }, tokens: { input: 1 } }])).toBe('1:m1:5:{"input":1}')
    expect(messageFingerprint([{ info: { id: "m2", timeCreated: 7 } }])).toBe("1:m2:7:")
  })
})
