import { describe, expect, test } from "vitest"
import { connectedProviderIds, parseUsage, parseIntegrationList, usageResponseSchema } from "../src/schemas.ts"

describe("parseUsage", () => {
  test("parses a full usage payload", () => {
    const raw = {
      usage: {
        rolling: { percent: 10, status: "ok", resetsAt: "2026-01-01T00:00:00Z" },
        weekly: { percent: 20 },
        monthly: { percent: 30 },
      },
    }
    expect(parseUsage(raw)).toEqual(raw)
  })

  test("parses an empty usage object", () => {
    expect(parseUsage({ usage: {} })).toEqual({ usage: {} })
  })

  test("rejects invalid percents and unknown shapes", () => {
    expect(parseUsage({ usage: { rolling: { percent: "high" } } })).toBeNull()
    expect(parseUsage({ nope: true })).toEqual({}) // zod strips unknown keys
    expect(parseUsage(null)).toBeNull()
    expect(parseUsage("usage")).toBeNull()
    expect(parseUsage(undefined)).toBeNull()
  })

  test("accepts a payload with no usage key", () => {
    expect(parseUsage({})).toEqual({})
  })
})

describe("usageResponseSchema", () => {
  test("window fields are optional", () => {
    expect(usageResponseSchema.safeParse({ usage: { rolling: {} } }).success).toBe(true)
  })
})

describe("parseIntegrationList", () => {
  const entry = { id: "opencode", connections: [{ type: "oauth" }] }

  test("parses the wrapped { data: [...] } shape", () => {
    expect(parseIntegrationList({ data: [entry] })).toEqual([entry])
  })

  test("parses a bare array", () => {
    expect(parseIntegrationList([entry])).toEqual([entry])
  })

  test("returns null for junk", () => {
    expect(parseIntegrationList({ data: "nope" })).toBeNull()
    expect(parseIntegrationList("nope")).toBeNull()
    expect(parseIntegrationList(null)).toBeNull()
    expect(parseIntegrationList([{ nope: true }])).toBeNull()
  })

  test("tolerates missing optional fields", () => {
    expect(parseIntegrationList([{ id: "x" }])).toEqual([{ id: "x" }])
    expect(parseIntegrationList({ data: [{ id: "x", name: 1, connections: "bad" }] })).toBeNull()
  })
})

describe("connectedProviderIds", () => {
  test("collects ids with non-empty connections", () => {
    const ids = connectedProviderIds({
      data: [
        { id: "opencode", connections: [{ type: "key" }] },
        { id: "opencode-go", connections: [] },
        { id: "google" },
      ],
    })
    expect(ids).toEqual(new Set(["opencode"]))
  })

  test("skips entries without an id", () => {
    expect(connectedProviderIds([{ connections: [{ type: "key" }] }])).toEqual(new Set())
  })

  test("returns an empty set for null input", () => {
    expect(connectedProviderIds(null)).toEqual(new Set())
  })

  test("treats a single connection object as connected", () => {
    expect(connectedProviderIds([{ id: "google", connections: [{}] }])).toEqual(new Set(["google"]))
  })
})
