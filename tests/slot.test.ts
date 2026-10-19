import { describe, expect, test, vi } from "vitest"
import { claimSlot } from "../src/slot.ts"

describe("claimSlot", () => {
  test("returns the host cleanup and strips kit-only options", () => {
    const cleanup = vi.fn()
    const slot = vi.fn(() => cleanup)
    const onError = vi.fn()
    const render = () => null
    const result = claimSlot({ ui: { slot } }, { append: "app", render, onError })
    expect(result).toBe(cleanup)
    expect(slot).toHaveBeenCalledWith({ append: "app", render })
  })

  test("returns a no-op when the host returns no cleanup", () => {
    const result = claimSlot({ ui: { slot: () => undefined } }, { append: "app", render: () => null })
    expect(() => result()).not.toThrow()
  })

  test("returns a no-op when the slot throws, reporting it when asked", () => {
    const error = new Error("no slot")
    const onError = vi.fn()
    const result = claimSlot(
      {
        ui: {
          slot: () => {
            throw error
          },
        },
      },
      { append: "app", render: () => null, onError },
    )
    expect(onError).toHaveBeenCalledWith(error)
    expect(() => result()).not.toThrow()
  })

  test("swallows a throw when there is no error sink", () => {
    const result = claimSlot(
      {
        ui: {
          slot: () => {
            throw new Error("no slot")
          },
        },
      },
      { append: "app", render: () => null },
    )
    expect(() => result()).not.toThrow()
  })

  test("does not throw when the host has no slot surface", () => {
    expect(() => claimSlot({}, { append: "app", render: () => null })()).not.toThrow()
    expect(() => claimSlot({ ui: {} }, { append: "app", render: () => null })()).not.toThrow()
  })
})
