import { describe, expect, test } from "vitest"
import { showToast } from "./toast.ts"
import { fakeContext } from "./testkit.ts"

describe("showToast", () => {
  test("shows a success toast by default", () => {
    const ctx = fakeContext()
    showToast(ctx, "done")
    expect(ctx.toastCalls).toEqual([{ message: "done", variant: "success" }])
  })

  test("passes the variant through", () => {
    const ctx = fakeContext()
    showToast(ctx, "nope", "error")
    expect(ctx.toastCalls[0]).toEqual({ message: "nope", variant: "error" })
  })

  test("no-ops when the host has no toast", () => {
    const ctx = fakeContext({ ui: {} as never })
    expect(() => showToast(ctx, "ignored")).not.toThrow()
    expect(ctx.toastCalls).toEqual([])
  })

  test("no-ops when toast.show throws", () => {
    const ctx = fakeContext({
      ui: {
        toast: {
          show: () => {
            throw new Error("boom")
          },
        },
      } as never,
    })
    expect(() => showToast(ctx, "ignored")).not.toThrow()
  })
})
