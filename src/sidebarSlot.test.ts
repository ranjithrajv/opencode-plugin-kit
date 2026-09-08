import { describe, expect, test, vi } from "vitest"
import { createRoot } from "solid-js"
import { createSessionResource } from "./sidebarSlot.ts"

/** Create the resource inside a live owner root (never disposed — the
 * resource's fetch effect must outlive creation to run). */
function inRoot<T>(make: () => T): T {
  return createRoot(() => make())
}

async function waitForData(fn: () => unknown): Promise<void> {
  await vi.waitFor(fn, { timeout: 2_000, interval: 10 })
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe("createSessionResource", () => {
  test("maps a null loader result to undefined so Show treats it as missing", async () => {
    const seen: Array<string | undefined> = []
    const r = inRoot(() =>
      createSessionResource(
        () => "s1",
        async (sid) => {
          seen.push(sid)
          return null
        },
      ),
    )
    await waitForData(() => expect(seen).toEqual(["s1"]))
    expect(r.data()).toBeUndefined()
  })

  test("passes the loader value through", async () => {
    const r = inRoot(() =>
      createSessionResource(
        () => "s2",
        async () => ({ usage: 42 }),
      ),
    )
    await waitForData(() => expect(r.data()).toEqual({ usage: 42 }))
  })

  test("refetch reloads", async () => {
    let calls = 0
    const r = inRoot(() =>
      createSessionResource(
        () => "s3",
        async () => ++calls,
      ),
    )
    await waitForData(() => expect(r.data()).toBe(1))
    r.refetch()
    await waitForData(() => expect(r.data()).toBe(2))
  })

  test("propagates loader errors onto the resource", async () => {
    const r = inRoot(() =>
      createSessionResource(
        () => "s4",
        async () => {
          throw new Error("boom")
        },
      ),
    )
    await waitForData(() => expect(r.data.error).toBeDefined())
  })

  test("exposes loading state before the loader resolves", async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const r = inRoot(() =>
      createSessionResource(
        () => "s5",
        () => gate.then(() => "late"),
      ),
    )
    expect(r.data.loading).toBe(true)
    release()
    await waitForData(() => expect(r.data()).toBe("late"))
  })
})
