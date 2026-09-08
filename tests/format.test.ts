import { describe, expect, test } from "vitest"
import { fmt, fmtCost, until } from "../src/format.ts"

describe("fmt", () => {
  test("formats finite numbers with locale grouping", () => {
    expect(fmt(1234567)).toBe("1,234,567")
    expect(fmt(0)).toBe("0")
  })

  test("falls back to 0 for non-numbers and non-finite values", () => {
    expect(fmt("12")).toBe("0")
    expect(fmt(null)).toBe("0")
    expect(fmt(undefined)).toBe("0")
    expect(fmt(Infinity)).toBe("0")
    expect(fmt(NaN)).toBe("0")
  })
})

describe("fmtCost", () => {
  test("formats numbers with the given precision", () => {
    expect(fmtCost(0.12345)).toBe("$0.1235")
    expect(fmtCost(1.5, 2)).toBe("$1.50")
    expect(fmtCost(0, 0)).toBe("$0")
  })

  test("passes non-empty strings through", () => {
    expect(fmtCost("$12")).toBe("$12")
    expect(fmtCost("  x  ")).toBe("  x  ")
  })

  test("falls back to zero for missing or invalid input", () => {
    expect(fmtCost(undefined)).toBe("$0.0000")
    expect(fmtCost(null)).toBe("$0.0000")
    expect(fmtCost("")).toBe("$0.0000")
    expect(fmtCost("   ")).toBe("$0.0000")
    expect(fmtCost(Infinity)).toBe("$0.0000")
    expect(fmtCost(NaN)).toBe("$0.0000")
  })
})

describe("until", () => {
  test("returns empty for absent or unparseable input", () => {
    expect(until(undefined)).toBe("")
    expect(until("")).toBe("")
    expect(until("not a date")).toBe("")
  })

  test("formats minutes under an hour", () => {
    const iso = new Date(Date.now() + 5 * 60_000).toISOString()
    expect(until(iso)).toBe("5m")
  })

  test("clamps past timestamps to 0 minutes", () => {
    const iso = new Date(Date.now() - 3 * 60_000).toISOString()
    expect(until(iso)).toBe("0m")
  })

  test("formats hours under two days", () => {
    const iso = new Date(Date.now() + 2 * 3600_000 + 30 * 60_000).toISOString()
    expect(until(iso)).toBe("2h 30m")
  })

  test("formats the boundary between hours and days", () => {
    const iso = new Date(Date.now() + 47 * 3600_000).toISOString()
    expect(until(iso)).toBe("47h 0m")
  })

  test("formats days beyond two days", () => {
    const iso = new Date(Date.now() + 3 * 24 * 3600_000 + 5 * 3600_000).toISOString()
    expect(until(iso)).toBe("3d 5h")
  })
})
