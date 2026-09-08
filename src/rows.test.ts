import { describe, expect, test } from "vitest"
import { bar, line, short } from "./rows.ts"

describe("short", () => {
  test("keeps short ids intact", () => {
    expect(short("gpt-5")).toBe("gpt-5")
    expect(short("exactly-twenty-four-char")).toBe("exactly-twenty-four-char")
  })

  test("truncates long ids with an ellipsis", () => {
    expect(short("abcdefghijklmnopqrstuvwxy", 24)).toBe("abcdefghijklmnopqrstuvw…")
    expect(short("12345678", 5)).toBe("1234…")
  })

  test("honors a custom width", () => {
    expect(short("abcdef", 3)).toBe("ab…")
  })
})

describe("line", () => {
  test("returns empty for an empty id", () => {
    expect(line("label", "", "zen")).toBe("")
  })

  test("formats without a value", () => {
    expect(line("ab", "id", "opencode")).toBe("ab     " + "id".padEnd(25) + " (zen)")
  })

  test("formats with a value", () => {
    const out = line("ab", "id", "opencode-go", "$1.00")
    expect(out).toBe("ab     " + "id".padEnd(25) + " (go) $1.00")
  })

  test("resizes the id column with width", () => {
    const out = line("ab", "long-model-id", "zen", "v", 10)
    expect(out).toBe("ab     long-mode… (zen) v")
  })
})

describe("bar", () => {
  test("renders empty at 0 percent", () => {
    expect(bar(0)).toBe("[──────────]")
  })

  test("renders half-filled at 50 percent", () => {
    expect(bar(50)).toBe("[━━━━━─────]")
  })

  test("renders full at 100 percent", () => {
    expect(bar(100)).toBe("[━━━━━━━━━━]")
  })

  test("clamps below 0 and above 100", () => {
    expect(bar(-10)).toBe("[──────────]")
    expect(bar(250)).toBe("[━━━━━━━━━━]")
  })

  test("honors a custom cell count", () => {
    expect(bar(50, 4)).toBe("[━━──]")
    expect(bar(100, 1)).toBe("[━]")
  })

  test("rounds to the nearest cell", () => {
    expect(bar(55)).toBe("[━━━━━━────]")
    expect(bar(55, 10)).toBe("[━━━━━━────]")
    expect(bar(45, 10)).toBe("[━━━━━─────]")
  })
})
