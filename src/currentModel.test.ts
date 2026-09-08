import { describe, expect, test } from "vitest"
import { createCurrentModelResolver, resolveCurrentModel } from "./currentModel.ts"
import { fakeContext } from "./testkit.ts"
import type { KitMessageShape } from "./host.ts"

const push = (ctx: ReturnType<typeof fakeContext>, ...m: KitMessageShape[]) => ctx.messages.push(...m)

describe("resolveCurrentModel", () => {
  test("returns undefined without a sessionID", () => {
    expect(resolveCurrentModel(fakeContext(), undefined)).toBeUndefined()
  })

  test("reads the newest assistant message, unwrapping envelopes", () => {
    const ctx = fakeContext()
    push(
      ctx,
      { info: { type: "assistant", providerID: "opencode", modelID: "old" } },
      { type: "user" },
      { type: "assistant", model: { providerID: "google", id: "gemini" } },
    )
    expect(resolveCurrentModel(ctx, "s")).toEqual({ providerID: "google", modelID: "gemini" })
  })

  test("falls back through the model id chain", () => {
    const ctx = fakeContext()
    push(ctx, { type: "assistant", providerID: "zen", modelID: "m1" })
    expect(resolveCurrentModel(ctx, "s")).toEqual({ providerID: "zen", modelID: "m1" })
    ctx.messages.length = 0
    push(ctx, { type: "assistant", providerID: "zen", id: "m2" })
    expect(resolveCurrentModel(ctx, "s")).toEqual({ providerID: "zen", modelID: "m2" })
  })

  test("skips assistant messages without a usable model pair", () => {
    const ctx = fakeContext()
    push(ctx, { type: "assistant" }, { type: "assistant", providerID: "zen", modelID: "m" })
    expect(resolveCurrentModel(ctx, "s")).toEqual({ providerID: "zen", modelID: "m" })
  })

  test("returns undefined when the session has no assistant messages", () => {
    const ctx = fakeContext()
    push(ctx, { type: "user" })
    expect(resolveCurrentModel(ctx, "s")).toBeUndefined()
  })

  test("returns undefined when the message list is empty", () => {
    expect(resolveCurrentModel(fakeContext(), "s")).toBeUndefined()
  })

  test("tolerates a list() that returns undefined", () => {
    const ctx = fakeContext()
    ctx.data.session.message.list = () => undefined
    expect(resolveCurrentModel(ctx, "s")).toBeUndefined()
  })

  test("skips assistant messages without a provider id", () => {
    const ctx = fakeContext()
    push(ctx, { type: "assistant", modelID: "m" })
    expect(resolveCurrentModel(ctx, "s")).toBeUndefined()
  })

  test("skips assistant messages whose model id only exists on the model object without a provider", () => {
    const ctx = fakeContext()
    push(ctx, { type: "assistant", model: { id: "via-model" } })
    expect(resolveCurrentModel(ctx, "s")).toBeUndefined()
  })

  test("skips assistant messages with a provider but no model id at all", () => {
    const ctx = fakeContext()
    push(ctx, { type: "assistant", providerID: "zen" })
    expect(resolveCurrentModel(ctx, "s")).toBeUndefined()
  })

  test("returns undefined when the message list throws", () => {
    const ctx = fakeContext()
    ctx.data.session.message.list = () => {
      throw new Error("boom")
    }
    expect(resolveCurrentModel(ctx, "s")).toBeUndefined()
  })
})

describe("createCurrentModelResolver", () => {
  test("re-resolves with the current sessionID on each call", () => {
    const ctx = fakeContext()
    push(ctx, { type: "assistant", providerID: "a", modelID: "m1" })
    let sid: string | undefined = "s1"
    const resolve = createCurrentModelResolver(ctx, () => sid)
    expect(resolve()).toEqual({ providerID: "a", modelID: "m1" })

    ctx.messages.length = 0
    push(ctx, { type: "assistant", providerID: "b", modelID: "m2" })
    sid = "s2"
    expect(resolve()).toEqual({ providerID: "b", modelID: "m2" })

    sid = undefined
    expect(resolve()).toBeUndefined()
  })
})
