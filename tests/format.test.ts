import { describe, expect, test } from "vitest"
import {
  compactNumber,
  fmt,
  fmtCost,
  formatClock,
  formatCost,
  formatDelta,
  formatDuration,
  formatPercent,
  shortPath,
  truncate,
  until,
} from "../src/format.ts"

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

describe("compactNumber", () => {
  test("keeps small numbers plain", () => {
    expect(compactNumber(0)).toBe("0")
    expect(compactNumber(999)).toBe("999")
    expect(compactNumber(-999)).toBe("-999")
  })

  test("scales thousands, millions and billions with three precisions", () => {
    expect(compactNumber(1000)).toBe("1k")
    expect(compactNumber(1234)).toBe("1.23k")
    expect(compactNumber(12_345)).toBe("12.3k")
    expect(compactNumber(123_456)).toBe("123k")
    expect(compactNumber(1_500_000)).toBe("1.5M")
    expect(compactNumber(2_000_000_000)).toBe("2B")
  })

  test("falls back to zero for non-finite values", () => {
    expect(compactNumber(Number.NaN)).toBe("0")
    expect(compactNumber(Number.POSITIVE_INFINITY)).toBe("0")
  })
})

describe("formatCost", () => {
  test("adapts precision to the magnitude", () => {
    expect(formatCost(0)).toBe("$0")
    expect(formatCost(-1)).toBe("$0")
    expect(formatCost(0.00001)).toBe("<$0.0001")
    expect(formatCost(0.5)).toBe("$0.5")
    expect(formatCost(1.2834)).toBe("$1.28")
    expect(formatCost(123.4)).toBe("$123")
  })

  test("falls back to zero for non-finite values", () => {
    expect(formatCost(Number.NaN)).toBe("$0")
    expect(formatCost(Number.POSITIVE_INFINITY)).toBe("$0")
  })
})

describe("formatDuration", () => {
  test("renders sub-second, second, minute and hour scales", () => {
    expect(formatDuration(5)).toBe("<10ms")
    expect(formatDuration(12)).toBe("12ms")
    expect(formatDuration(1500)).toBe("1.5s")
    expect(formatDuration(60_000)).toBe("1m")
    expect(formatDuration(61_000)).toBe("1m 1s")
    expect(formatDuration(90_000)).toBe("1m 30s")
    expect(formatDuration(3_600_000)).toBe("1h")
    expect(formatDuration(3_660_000)).toBe("1h 1m")
  })

  test("rejects negative and non-finite durations", () => {
    expect(formatDuration(-1)).toBe("—")
    expect(formatDuration(Number.NaN)).toBe("—")
  })
})

describe("formatClock", () => {
  test("renders local wall-clock time", () => {
    const at = new Date(2024, 0, 2, 3, 4, 5).getTime()
    expect(formatClock(at)).toBe("03:04:05")
  })

  test("rejects absent timestamps", () => {
    expect(formatClock(0)).toBe("—")
    expect(formatClock(Number.NaN)).toBe("—")
  })
})

describe("formatDelta", () => {
  test("formats a positive gap", () => {
    expect(formatDelta(1000, 1500)).toBe("+500ms")
  })

  test("returns empty for absent, equal or backwards gaps", () => {
    expect(formatDelta(Number.NaN, 1500)).toBe("")
    expect(formatDelta(1000, Number.NaN)).toBe("")
    expect(formatDelta(0, 1500)).toBe("")
    expect(formatDelta(1000, 1000)).toBe("")
    expect(formatDelta(2000, 1500)).toBe("")
  })
})

describe("formatPercent", () => {
  test("renders sub-10% ratios with one decimal", () => {
    expect(formatPercent(0.05)).toBe("5%")
    expect(formatPercent(0.001)).toBe("0.1%")
  })

  test("rounds larger ratios", () => {
    expect(formatPercent(0.245)).toBe("25%")
  })

  test("returns zero for absent ratios", () => {
    expect(formatPercent(0)).toBe("0%")
    expect(formatPercent(Number.NaN)).toBe("0%")
  })
})

describe("shortPath", () => {
  test("keeps paths that already fit", () => {
    expect(shortPath("src/parser.ts", 40)).toBe("src/parser.ts")
    expect(shortPath("a\\b", 40)).toBe("a/b")
  })

  test("keeps the filename and as much of the tail as fits", () => {
    expect(shortPath("/home/me/project/src/parser.ts", 20)).toBe("…/src/parser.ts")
  })

  test("truncates the filename itself when it cannot fit", () => {
    expect(shortPath("a/very-long-filename-here.ts", 12)).toBe("very-long-f…")
  })

  test("handles degenerate widths and slash-only paths", () => {
    expect(shortPath("src/parser.ts", 1)).toBe("…")
    expect(shortPath("////", 2)).toBe("/…")
  })
})

describe("truncate", () => {
  test("collapses whitespace and ellipsizes on one line", () => {
    expect(truncate("hello   world", 20)).toBe("hello world")
    expect(truncate("hello world", 8)).toBe("hello w…")
  })

  test("handles zero and one-column widths", () => {
    expect(truncate("hello", 0)).toBe("")
    expect(truncate("hello", 1)).toBe("…")
  })
})
