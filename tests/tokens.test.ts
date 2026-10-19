import { describe, expect, test } from "vitest"
import { estimateTokens, messageCost, tokenBreakdown } from "../src/tokens.ts"

describe("tokenBreakdown", () => {
  test("normalizes plain numeric cache counts", () => {
    expect(
      tokenBreakdown({
        tokens: { input: 1000, output: 200, reasoning: 50, cache: { read: 500, write: 100 } },
      }),
    ).toEqual({ input: 1000, output: 200, reasoning: 50, cacheRead: 500, cacheWrite: 100, total: 1850 })
  })

  test("accepts nested cache counts", () => {
    expect(tokenBreakdown({ tokens: { input: 1, cache: { read: { input: 7 }, write: { input: 3 } } } })).toEqual({
      input: 1,
      output: 0,
      reasoning: 0,
      cacheRead: 7,
      cacheWrite: 3,
      total: 11,
    })
  })

  test("reads missing, malformed and non-finite fields as zero", () => {
    expect(tokenBreakdown(undefined)).toEqual({
      input: 0,
      output: 0,
      reasoning: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: 0,
    })
    expect(tokenBreakdown({ tokens: { input: Number.NaN, cache: { read: Number.POSITIVE_INFINITY } } })).toEqual({
      input: 0,
      output: 0,
      reasoning: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: 0,
    })
    expect(tokenBreakdown({ tokens: { cache: { read: { input: "7" } } } })).toMatchObject({ cacheRead: 0 })
  })
})

describe("messageCost", () => {
  test("reads numeric and object costs", () => {
    expect(messageCost({ cost: 0.02 })).toBe(0.02)
    expect(messageCost({ cost: { total: 1.5 } })).toBe(1.5)
    expect(messageCost({ cost: { cost: 2.5 } })).toBe(2.5)
  })

  test("reads absent, malformed and non-finite costs as zero", () => {
    expect(messageCost(undefined)).toBe(0)
    expect(messageCost({})).toBe(0)
    expect(messageCost({ cost: "1" })).toBe(0)
    expect(messageCost({ cost: Number.NaN })).toBe(0)
    expect(messageCost({ cost: {} })).toBe(0)
    expect(messageCost({ cost: { total: Number.NaN } })).toBe(0)
  })
})

describe("estimateTokens", () => {
  test("estimates four characters per token with a floor of one", () => {
    expect(estimateTokens("")).toBe(1)
    expect(estimateTokens("abcd")).toBe(1)
    expect(estimateTokens("abcdefgh")).toBe(2)
    expect(estimateTokens(null as unknown as string)).toBe(1)
  })
})
