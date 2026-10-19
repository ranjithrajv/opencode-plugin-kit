import { describe, expect, test } from "vitest"
import { toneColor } from "../src/theme.ts"

describe("toneColor", () => {
  test("falls back to the neutral palette without a theme", () => {
    expect(toneColor(undefined)).toBe("#ffffff")
    expect(toneColor({}, "base")).toBe("#ffffff")
    expect(toneColor({}, "muted")).toBe("#888888")
    expect(toneColor({}, "error")).toBe("#ff5555")
    expect(toneColor({}, "warning")).toBe("#f1fa8c")
    expect(toneColor({}, "success")).toBe("#50fa7b")
    expect(toneColor({}, "info")).toBe("#8be9fd")
  })

  test("reads base and muted from the text block aliases", () => {
    expect(toneColor({ text: { base: "b" } })).toBe("b")
    expect(toneColor({ text: { default: "d" } }, "base")).toBe("d")
    expect(toneColor({ text: { muted: "m" } }, "muted")).toBe("m")
    expect(toneColor({ text: { subdued: "s" } }, "muted")).toBe("s")
  })

  test("prefers feedback colours", () => {
    expect(
      toneColor(
        {
          text: {
            feedback: {
              error: { base: "e" },
              warning: { base: "w" },
              success: { base: "s" },
              info: { base: "i" },
            },
          },
        },
        "error",
      ),
    ).toBe("e")
    expect(toneColor({ text: { feedback: { warning: { base: "w" } } } }, "warning")).toBe("w")
    expect(toneColor({ text: { feedback: { success: { base: "s" } } } }, "success")).toBe("s")
    expect(toneColor({ text: { feedback: { info: { base: "i" } } } }, "info")).toBe("i")
  })

  test("falls back to status colours when feedback lacks the tone", () => {
    const theme = {
      text: { feedback: { error: {} } },
      status: { error: "se", warning: "sw", success: "ss", info: "si" },
    }
    expect(toneColor(theme, "error")).toBe("se")
    expect(toneColor(theme, "warning")).toBe("sw")
    expect(toneColor(theme, "success")).toBe("ss")
    expect(toneColor(theme, "info")).toBe("si")
  })

  test("falls back to plain text aliases before the default palette", () => {
    expect(toneColor({ text: { danger: "d" } }, "error")).toBe("d")
    expect(toneColor({ text: { warning: "w" } }, "warning")).toBe("w")
    expect(toneColor({ text: { info: "i" } }, "info")).toBe("i")
  })
})
