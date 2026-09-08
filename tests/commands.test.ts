import { describe, expect, test, vi } from "vitest"
import { createToggle, registerKeymapCommand } from "../src/commands.ts"
import { fakeContext, fakeStorage, type FakeCell } from "../src/testkit.ts"

describe("registerKeymapCommand", () => {
  test("registers through an app slot keymap layer", () => {
    const ctx = fakeContext()
    registerKeymapCommand(ctx, { id: "x", title: "T", description: "D", group: "G", run: () => {} })
    expect(ctx.slotCalls[0]).toMatchObject({ append: "app" })
    // The layer is registered by rendering the slot.
    ;(ctx.slotCalls[0].render as () => void)()
    expect(ctx.layerCalls[0]).toMatchObject({ mode: "global", priority: 10, commands: [{ id: "x" }] })
  })

  test("the factory form re-evaluates per layer render (fresh titles)", () => {
    const ctx = fakeContext()
    let title = "v1"
    registerKeymapCommand(ctx, () => ({ id: "x", title, description: "D", group: "G", run: () => {} }))
    const render = ctx.slotCalls[0].render as () => void
    render()
    title = "v2"
    render()
    expect(ctx.layerCalls[0]).toMatchObject({ commands: [{ title: "v1" }] })
    expect(ctx.layerCalls[1]).toMatchObject({ commands: [{ title: "v2" }] })
  })

  test("keymap failures are warnings, not throws", () => {
    const ctx = fakeContext()
    vi.mocked(ctx.keymap.layer).mockImplementation(() => {
      throw new Error("no layer")
    })
    expect(() =>
      registerKeymapCommand(ctx, { id: "x", title: "T", description: "D", group: "G", run: () => {} }),
    ).not.toThrow()
  })

  test("slot failures are warnings, not throws", () => {
    const ctx = fakeContext()
    vi.mocked(ctx.ui.slot).mockImplementation(() => {
      throw new Error("no slot")
    })
    expect(() =>
      registerKeymapCommand(ctx, { id: "x", title: "T", description: "D", group: "G", run: () => {} }),
    ).not.toThrow()
  })
})

describe("createToggle", () => {
  const config = {
    storageKey: "t",
    initial: true,
    command: { id: "c", group: "G", name: "t", description: "D", title: (v: boolean) => `T ${v}` },
  }

  test("starts from the initial value and persists flips", () => {
    const cells: Record<string, unknown> = {}
    const ctx = fakeContext({ storage: fakeStorage(cells) })
    const toggle = createToggle(ctx, config)
    expect(toggle.value()).toBe(true)
    toggle.toggle()
    expect(toggle.value()).toBe(false)
    expect((cells.t as FakeCell<{ value: boolean }>).value).toBe(false)
  })

  test("restores a readable persisted value over initial", () => {
    const ctx = fakeContext({ storage: fakeStorage({ t: { value: false } }) })
    const toggle = createToggle(ctx, config)
    expect(toggle.value()).toBe(false)
  })

  test("a foreign persisted shape falls back to initial", () => {
    // The plugin manager's legacy shape under the same key: { show } not { value }.
    const ctx = fakeContext({ storage: fakeStorage({ t: { show: false } }) })
    const toggle = createToggle(ctx, config)
    expect(toggle.value()).toBe(true)
  })

  test("toast fires with the new value; silent when omitted", () => {
    const ctx = fakeContext()
    const toggle = createToggle(ctx, { ...config, toast: (v) => `now ${v}` })
    toggle.toggle()
    expect(ctx.toastCalls).toEqual([{ message: "now false", variant: "success" }])
    const silent = createToggle(ctx, config)
    silent.toggle()
    expect(ctx.toastCalls).toHaveLength(1)
  })

  test("registerCommand builds a slash command that toggles", () => {
    const ctx = fakeContext()
    const toggle = createToggle(ctx, config)
    toggle.registerCommand()
    ;(ctx.slotCalls[0].render as () => void)()
    const layer = ctx.layerCalls[0] as {
      commands: Array<{ id: string; title: string; slash?: { name: string }; run: () => void }>
    }
    const command = layer.commands[0]
    expect(command.id).toBe("c")
    expect(command.title).toBe("T true")
    expect(command.slash?.name).toBe("t")
    command.run()
    expect(toggle.value()).toBe(false)
  })

  test("falls back to in-memory when storage throws", () => {
    const ctx = fakeContext({
      storage: {
        store: () => {
          throw new Error("no storage")
        },
      },
    })
    const toggle = createToggle(ctx, config)
    expect(toggle.value()).toBe(true)
    toggle.toggle()
    expect(toggle.value()).toBe(false)
  })
})
