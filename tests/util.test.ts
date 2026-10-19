import { describe, expect, test } from "vitest"
import { safe } from "../src/util.ts"

describe("safe", () => {
  test("returns the value when the reader succeeds", () => {
    expect(safe(() => 42, 0)).toBe(42)
  })

  test("returns the fallback when the reader throws", () => {
    expect(
      safe(() => {
        throw new Error("host changed")
      }, "fallback"),
    ).toBe("fallback")
  })
})
