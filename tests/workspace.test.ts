import { describe, expect, test } from "vitest"
import { resolveLocation, workspaceDirectory } from "../src/workspace.ts"

describe("resolveLocation", () => {
  test("prefers context.location", () => {
    const location = { directory: "/w/a" }
    expect(resolveLocation({ location, data: { location: { default: () => "other" } } })).toBe(location)
  })

  test("falls back to data.location.default()", () => {
    const location = { directory: "/w/b" }
    expect(resolveLocation({ data: { location: { default: () => location } } })).toBe(location)
  })
})

describe("workspaceDirectory", () => {
  test("reads .directory off the location", () => {
    expect(workspaceDirectory({ location: { directory: "/w/c" } })).toBe("/w/c")
  })

  test("uses the location itself when it has no .directory", () => {
    expect(workspaceDirectory({ location: "/w/d" })).toBe("/w/d")
  })

  test('falls back to "." when nothing resolves', () => {
    expect(workspaceDirectory({ data: { location: { default: () => undefined } } })).toBe(".")
  })
})
