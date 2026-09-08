import { describe, expect, test } from "vitest"
import { cacheReadInput, sumProviderTokens, walkMessages } from "../src/messages.ts"
import { fakeContext } from "../src/testkit.ts"
import type { KitMessageShape } from "../src/host.ts"

const assistant = (over: Partial<KitMessageShape> = {}): KitMessageShape => ({
  type: "assistant",
  providerID: "opencode",
  modelID: "m",
  ...over,
})

describe("walkMessages", () => {
  test("returns the initial value without a sessionID", () => {
    const ctx = fakeContext()
    expect(walkMessages(ctx, undefined, () => 1, {}, 0)).toBe(0)
    expect(ctx.data.session.message.list).not.toHaveBeenCalled()
  })

  test("returns the initial value when the message list throws", () => {
    const ctx = fakeContext()
    ctx.data.session.message.list = () => {
      throw new Error("boom")
    }
    expect(walkMessages(ctx, "s", () => 1, {}, 0)).toBe(0)
  })

  test("tolerates a list() that returns undefined", () => {
    const ctx = fakeContext()
    ctx.data.session.message.list = () => undefined
    expect(walkMessages(ctx, "s", () => 1, {}, 0)).toBe(0)
  })

  test("walks newest-first and folds the accumulator", () => {
    const ctx = fakeContext()
    ctx.messages.push(assistant({ id: "old" }), assistant({ id: "new" }))
    const seen: Array<string | undefined> = []
    const out = walkMessages(
      ctx,
      "s",
      (m, acc) => {
        seen.push(m?.id)
        return acc + 1
      },
      {},
      0,
    )
    expect(out).toBe(2)
    expect(seen).toEqual(["new", "old"])
  })

  test("keeps the accumulator when the reducer returns void", () => {
    const ctx = fakeContext()
    ctx.messages.push(assistant())
    expect(walkMessages(ctx, "s", () => undefined, {}, 7)).toBe(7)
  })

  test("unwraps { info } envelopes", () => {
    const ctx = fakeContext()
    ctx.messages.push({ info: assistant({ providerID: "zen" }) })
    const out = walkMessages(ctx, "s", (m) => m?.providerID, { provider: "zen" }, "")
    expect(out).toBe("zen")
  })

  test("assistantOnly=false visits non-assistant messages", () => {
    const ctx = fakeContext()
    ctx.messages.push({ type: "user", id: "u" })
    const out = walkMessages(ctx, "s", (m) => m?.id, { assistantOnly: false }, "")
    expect(out).toBe("u")
  })

  test("assistantOnly=true (default) skips user messages", () => {
    const ctx = fakeContext()
    ctx.messages.push({ type: "user", id: "u" })
    expect(walkMessages(ctx, "s", () => 1, {}, 0)).toBe(0)
  })

  test("provider filter matches model.providerID then top-level providerID", () => {
    const ctx = fakeContext()
    ctx.messages.push(assistant({ providerID: "opencode-go" }))
    ctx.messages.push({ type: "assistant", model: { providerID: "google", modelID: "x" } })
    ctx.messages.push(assistant({ providerID: "opencode" }))
    const seen: Array<string> = []
    walkMessages(
      ctx,
      "s",
      (m) => {
        seen.push(m?.providerID ?? m?.model?.providerID ?? "")
        return undefined
      },
      { provider: "opencode" },
      null,
    )
    expect(seen).toEqual(["opencode"])

    const seen2: Array<string> = []
    walkMessages(
      ctx,
      "s",
      (m) => {
        seen2.push(m?.model?.providerID ?? "")
        return undefined
      },
      { provider: "google" },
      null,
    )
    expect(seen2).toEqual(["google"])
  })

  test("provider filter tolerates missing provider fields", () => {
    const ctx = fakeContext()
    ctx.messages.push({ type: "assistant" })
    expect(walkMessages(ctx, "s", () => 1, { provider: "zen" }, 0)).toBe(0)
  })

  test("since filter accepts numeric time.created and ISO timeCreated", () => {
    const ctx = fakeContext()
    const now = 10_000
    ctx.messages.push(
      assistant({ id: "old", time: { created: 5_000 } }),
      assistant({ id: "iso", timeCreated: new Date(now + 100).toISOString() }),
      assistant({ id: "num", time: { created: now + 200 } }),
    )
    const seen: Array<string | undefined> = []
    walkMessages(
      ctx,
      "s",
      (m) => {
        seen.push(m?.id)
        return undefined
      },
      { since: now },
      null,
    )
    expect(seen).toEqual(["num", "iso"])
  })

  test("since filter reads the createdAt ISO string fallback", () => {
    const ctx = fakeContext()
    const iso = new Date(20_000).toISOString()
    ctx.messages.push(assistant({ id: "c", createdAt: iso }))
    const seen: Array<string | undefined> = []
    walkMessages(
      ctx,
      "s",
      (m) => {
        seen.push(m?.id)
        return undefined
      },
      { since: 10_000 },
      null,
    )
    expect(seen).toEqual(["c"])
  })

  test("since filter skips unparseable or missing timestamps", () => {
    const ctx = fakeContext()
    ctx.messages.push(assistant({ id: "bad", timeCreated: "garbage" }), assistant({ id: "none" }))
    expect(walkMessages(ctx, "s", () => 1, { since: 10_000 }, 0)).toBe(0)
  })

  test("since filter skips timestamps before the window", () => {
    const ctx = fakeContext()
    ctx.messages.push(assistant({ time: { created: 9_999 } }))
    expect(walkMessages(ctx, "s", () => 1, { since: 10_000 }, 0)).toBe(0)
  })
})

describe("cacheReadInput", () => {
  test("returns the raw cache.read value (number or nested object)", () => {
    expect(cacheReadInput({ cache: { read: 12 } })).toBe(12)
    expect(cacheReadInput({ cache: { read: { input: 5 } } })).toEqual({ input: 5 })
    expect(cacheReadInput(undefined)).toBeUndefined()
    expect(cacheReadInput({})).toBeUndefined()
  })
})

describe("sumProviderTokens", () => {
  test("sums tokens, nested cache reads, and cost for one provider", () => {
    const ctx = fakeContext()
    ctx.messages.push(
      {
        type: "assistant",
        providerID: "opencode",
        cost: 0.5,
        tokens: { input: 10, output: 20, reasoning: 3, cache: { read: { input: 7 } } },
      },
      {
        type: "assistant",
        providerID: "opencode",
        cost: 0.25,
        tokens: { input: 1, output: 2, cache: { read: 4 } },
      },
      { type: "assistant", providerID: "other", tokens: { input: 999 } },
    )
    expect(sumProviderTokens(ctx, "s", "opencode")).toEqual({
      input: 11,
      output: 22,
      reasoning: 3,
      cacheRead: 11,
      cost: 0.75,
    })
  })

  test("coerces junk token values to zero", () => {
    const ctx = fakeContext()
    ctx.messages.push({
      type: "assistant",
      providerID: "opencode",
      tokens: { input: "junk", output: null, cache: { read: "x" } },
      cost: "junk",
    })
    expect(sumProviderTokens(ctx, "s", "opencode")).toEqual({
      input: 0,
      output: 0,
      reasoning: 0,
      cacheRead: 0,
      cost: 0,
    })
  })

  test("treats a nested cache.read without input as zero", () => {
    const ctx = fakeContext()
    ctx.messages.push({
      type: "assistant",
      providerID: "opencode",
      tokens: { input: 5, cache: { read: {} } },
    })
    const out = sumProviderTokens(ctx, "s", "opencode")
    expect(out.cacheRead).toBe(0)
    expect(out.input).toBe(5)
  })

  test("treats a missing tokens object as zeros", () => {
    const ctx = fakeContext()
    ctx.messages.push({ type: "assistant", providerID: "opencode" })
    expect(sumProviderTokens(ctx, "s", "opencode").input).toBe(0)
  })

  test("applies the since window", () => {
    const ctx = fakeContext()
    ctx.messages.push(
      assistant({ providerID: "opencode", time: { created: 1_000 }, tokens: { input: 5 } }),
      assistant({ providerID: "opencode", time: { created: 20_000 }, tokens: { input: 6 } }),
    )
    const out = sumProviderTokens(ctx, "s", "opencode", 10_000)
    expect(out.input).toBe(6)
  })
})
