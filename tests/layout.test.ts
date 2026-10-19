import { describe, expect, test } from "vitest"
import { budgetFor, columnFor, compactFor } from "../src/layout.ts"

describe("budgetFor", () => {
  test("subtracts the gutter from a measured width", () => {
    expect(budgetFor(100)).toBe(98)
  })

  test("uses the fallback before the first layout pass", () => {
    expect(budgetFor(0)).toBe(38)
  })

  test("never goes below the minimum row", () => {
    expect(budgetFor(5)).toBe(12)
  })

  test("honors overrides", () => {
    expect(budgetFor(0, { fallbackWidth: 50 })).toBe(48)
    expect(budgetFor(100, { gutter: 10 })).toBe(90)
    expect(budgetFor(10, { minRow: 20 })).toBe(20)
  })
})

describe("compactFor", () => {
  test("switches to compact below the threshold", () => {
    expect(compactFor(19)).toBe(true)
    expect(compactFor(20)).toBe(false)
    expect(compactFor(10, { compactBelow: 5 })).toBe(false)
  })
})

describe("columnFor", () => {
  test("clamps the wanted width to the row budget and the maximum", () => {
    expect(columnFor(100, 10)).toBe(10)
    expect(columnFor(100, 50)).toBe(30)
    expect(columnFor(20, 50)).toBe(6)
  })

  test("honors a custom maximum", () => {
    expect(columnFor(100, 50, { maxColumn: 5 })).toBe(5)
  })
})
