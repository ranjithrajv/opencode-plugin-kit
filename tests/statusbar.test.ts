import { describe, expect, test, vi } from "vitest"
import { createStatusbar } from "../src/statusbar.ts"

function statusbarContext() {
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

describe("createStatusbar", () => {
  test("claims the specified footer slot", () => {
    const { context, slots } = statusbarContext()
    const render = vi.fn(() => "content")
    const handle = createStatusbar(context, { slot: "home.footer", render })

    expect(slots).toHaveLength(1)
    expect(slots[0]).toMatchObject({ append: "home.footer" })
    expect(handle.slot).toBe("home.footer")
    expect(typeof handle.cleanup).toBe("function")
  })

  test("passes render input through to the render function", () => {
    const { context, slots } = statusbarContext()
    const render = vi.fn(() => null)
    createStatusbar(context, { slot: "prompt.footer.status", render })

    const slotRender = slots[0].render as (input: unknown) => unknown
    const input = { sessionID: "s1", mode: "normal" }
    slotRender(input)
    expect(render).toHaveBeenCalledWith(input)
  })

  test("returns the cleanup function from claimSlot", () => {
    const { context, slotFn } = statusbarContext()
    const cleanup = vi.fn()
    slotFn.mockReturnValueOnce(cleanup)

    const handle = createStatusbar(context, { slot: "home.footer", render: () => null })
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

    const handle = createStatusbar(context, { slot: "home.footer", render: () => null, onError })
    expect(onError).toHaveBeenCalledOnce()
    expect(errors[0]).toBeInstanceOf(Error)
    expect(typeof handle.cleanup).toBe("function")
    expect(() => handle.cleanup()).not.toThrow()
  })

  test("works with all supported slot paths", () => {
    const slots = [
      "home.footer",
      "home.footer.status",
      "prompt.footer",
      "prompt.footer.status",
      "prompt.footer.file",
    ] as const
    for (const slot of slots) {
      const { context, slots: calls } = statusbarContext()
      createStatusbar(context, { slot, render: () => null })
      expect(calls[0]).toMatchObject({ append: slot })
    }
  })

  test("render receives undefined input for slots with no input", () => {
    const { context, slots } = statusbarContext()
    const render = vi.fn(() => null)
    createStatusbar(context, { slot: "home.footer", render })

    const slotRender = slots[0].render as (input: unknown) => unknown
    slotRender(undefined)
    expect(render).toHaveBeenCalledWith(undefined)
  })
})
