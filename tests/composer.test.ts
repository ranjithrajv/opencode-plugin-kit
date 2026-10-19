import { describe, expect, test, vi } from "vitest"
import { createComposer } from "../src/composer.ts"

function composerContext() {
  const slots: Array<Record<string, unknown>> = []
  const errors: unknown[] = []
  const slotFn = vi.fn((options: Record<string, unknown>) => {
    slots.push(options)
    return () => {}
  })
  const context: any = {
    ui: {
      slot: slotFn,
    },
  }
  return { context, slots, errors, slotFn }
}

describe("createComposer", () => {
  test("claims the session.composer.top slot", () => {
    const { context, slots } = composerContext()
    const render = vi.fn(() => null)
    const handle = createComposer(context, { render })

    expect(slots).toHaveLength(1)
    expect(slots[0]).toMatchObject({ append: "session.composer.top" })
    expect(typeof handle.cleanup).toBe("function")
  })

  test("passes render input through to the render function", () => {
    const { context, slots } = composerContext()
    const render = vi.fn(() => null)
    createComposer(context, { render })

    const slotRender = slots[0].render as (input: unknown) => unknown
    const input = { sessionID: "s1" }
    slotRender(input)
    expect(render).toHaveBeenCalledWith(input)
  })

  test("tracks the last render input", () => {
    const { context, slots } = composerContext()
    const handle = createComposer(context, { render: () => null })

    expect(handle.input()).toBeUndefined()

    const slotRender = slots[0].render as (input: unknown) => unknown
    slotRender({ sessionID: "s1" })
    expect(handle.input()).toEqual({ sessionID: "s1" })

    slotRender({ sessionID: "s2" })
    expect(handle.input()).toEqual({ sessionID: "s2" })
  })

  test("returns the cleanup function from claimSlot", () => {
    const { context, slotFn } = composerContext()
    const cleanup = vi.fn()
    slotFn.mockReturnValueOnce(cleanup)

    const handle = createComposer(context, { render: () => null })
    expect(handle.cleanup).toBe(cleanup)
    handle.cleanup()
    expect(cleanup).toHaveBeenCalledOnce()
  })

  test("calls onError when the host throws during claim", () => {
    const errors: unknown[] = []
    const onError = vi.fn((err: unknown) => errors.push(err))
    const context: any = {
      ui: {
        slot: () => {
          throw new Error("slot unavailable")
        },
      },
    }

    const handle = createComposer(context, { render: () => null, onError })
    expect(onError).toHaveBeenCalledOnce()
    expect(errors[0]).toBeInstanceOf(Error)
    expect(typeof handle.cleanup).toBe("function")
    expect(() => handle.cleanup()).not.toThrow()
  })

  test("render receives undefined input for slots with no input", () => {
    const { context, slots } = composerContext()
    const render = vi.fn(() => null)
    createComposer(context, { render })

    const slotRender = slots[0].render as (input: unknown) => unknown
    slotRender(undefined)
    expect(render).toHaveBeenCalledWith(undefined)
  })

  test("works with no context at all", () => {
    const handle = createComposer(undefined as any, { render: () => null })
    expect(typeof handle.cleanup).toBe("function")
    expect(handle.input()).toBeUndefined()
  })
})
