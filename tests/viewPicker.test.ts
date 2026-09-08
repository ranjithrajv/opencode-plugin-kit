import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { createRoot, untrack } from "solid-js"
import { createViewPicker, type PickerConfig, type PickerOption } from "../src/viewPicker.ts"
import { fakeContext, fakeStorage } from "./testkit.ts"
import type { KitContext } from "../src/index.ts"

interface Option extends PickerOption {}
const registry: Option[] = [
  { id: "go", title: "Go", description: "go view" },
  { id: "zen", title: "Zen" },
]

function config(over: Partial<PickerConfig<Option>> = {}): PickerConfig<Option> {
  return {
    registry,
    storageKey: "view",
    command: {
      id: "test.view",
      group: "Test",
      name: "test-view",
      title: (current) => `view: ${current.title}`,
      description: "pick a view",
    },
    dialog: { title: "Pick", message: "choose" },
    ...over,
  }
}

function make(context = fakeContext(), cfg = config()) {
  return createRoot((dispose) => {
    const picker = createViewPicker(context, cfg)
    return { picker, dispose, context, cfg }
  })
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("createViewPicker", () => {
  test("throws on an empty registry", () => {
    expect(() => createViewPicker(fakeContext(), config({ registry: [] }))).toThrow("empty registry")
  })

  test("defaults to the first entry", () => {
    const { picker, dispose } = make()
    untrack(() => {
      expect(picker.currentID()).toBe("go")
      expect(picker.current().title).toBe("Go")
    })
    dispose()
  })

  test("restores a persisted pick", () => {
    const ctx = fakeContext()
    ;(ctx as { storage: unknown }).storage = fakeStorage({ view: { id: "zen" } })
    const { picker, dispose } = make(ctx)
    expect(picker.currentID()).toBe("zen")
    dispose()
  })

  test("ignores a persisted pick that is no longer in the registry", () => {
    const ctx = fakeContext()
    ;(ctx as { storage: unknown }).storage = fakeStorage({ view: { id: "removed" } })
    const { picker, dispose } = make(ctx)
    expect(picker.currentID()).toBe("go")
    dispose()
  })

  test("falls back to in-memory when storage throws on load", () => {
    const ctx = fakeContext()
    ;(ctx as { storage: unknown }).storage = {
      store: () => {
        throw new Error("no storage")
      },
    }
    const { picker, dispose } = make(ctx)
    expect(picker.currentID()).toBe("go")
    dispose()
  })

  test("apply switches, persists and toasts", () => {
    const ctx = fakeContext()
    const { picker, dispose } = make(ctx)
    picker.apply(registry[1]!)
    expect(picker.currentID()).toBe("zen")
    expect(ctx.toastCalls).toEqual([{ message: "Zen", variant: "success" }])
    dispose()
  })

  test("apply uses toastPrefix and falls back to the plain title", () => {
    const ctx1 = fakeContext()
    make(ctx1, config({ toastPrefix: "Usage footer" })).picker.apply(registry[1]!)
    expect(ctx1.toastCalls[0]!.message).toBe("Usage footer: Zen view")

    const ctx2 = fakeContext()
    make(ctx2, config({ toastPrefix: undefined })).picker.apply(registry[1]!)
    expect(ctx2.toastCalls[0]!.message).toBe("Zen")
  })

  test("apply is a no-op when the entry is already selected", () => {
    const ctx = fakeContext()
    const { picker, dispose } = make(ctx)
    picker.apply(registry[0]!)
    expect(picker.currentID()).toBe("go")
    expect(ctx.toastCalls).toEqual([])
    dispose()
  })

  test("apply survives a throwing toast", () => {
    const ctx = fakeContext()
    ctx.ui.toast.show = () => {
      throw new Error("no toast")
    }
    const { picker, dispose } = make(ctx)
    expect(() => picker.apply(registry[1]!)).not.toThrow()
    expect(picker.currentID()).toBe("zen")
    dispose()
  })

  test("apply survives throwing storage", () => {
    const ctx = fakeContext()
    ;(ctx as { storage: unknown }).storage = {
      store: (() => {
        throw new Error("no storage")
      }) as KitContext["storage"]["store"],
    }
    const { picker, dispose } = make(ctx)
    picker.apply(registry[1]!)
    expect(picker.currentID()).toBe("zen")
    dispose()
  })

  test("pick with a matching id argument applies it directly", async () => {
    const ctx = fakeContext()
    const { picker, dispose } = make(ctx)
    await picker.pick("zen")
    expect(picker.currentID()).toBe("zen")
    expect(ctx.ui.dialog.select).not.toHaveBeenCalled()
    dispose()
  })

  test("pick with a matching title argument applies it", async () => {
    const ctx = fakeContext()
    const { picker, dispose } = make(ctx)
    await picker.pick("ZEN") // case-insensitive title match
    expect(picker.currentID()).toBe("zen")
    dispose()
  })

  test("pick alerts when the requested entry is not selectable", async () => {
    const ctx = fakeContext()
    const { picker, dispose } = make(
      ctx,
      config({
        selectable: (e) => e.id !== "zen",
        unavailableMessage: (e) => `${e.title} has no key.`,
      }),
    )
    await picker.pick("zen")
    expect(picker.currentID()).toBe("go")
    expect(ctx.alertCalls).toEqual([{ title: "Pick", message: "Zen has no key." }])
    dispose()
  })

  test("pick uses the default unavailable message", async () => {
    const ctx = fakeContext()
    const { picker, dispose } = make(ctx, config({ selectable: () => false }))
    await picker.pick("zen")
    expect(ctx.alertCalls).toEqual([{ title: "Pick", message: "Zen is not available right now." }])
    dispose()
  })

  test("pick alerts on an unknown argument, listing selectable views", async () => {
    const ctx = fakeContext()
    const { picker, dispose } = make(ctx)
    await picker.pick("nope")
    expect(ctx.alertCalls).toEqual([{ title: "Pick", message: 'Unknown view "nope". Available: go, zen' }])
    dispose()
  })

  test("pick lists 'none' when nothing is selectable", async () => {
    const ctx = fakeContext()
    const { picker, dispose } = make(ctx, config({ selectable: () => false }))
    await picker.pick("nope")
    expect(ctx.alertCalls).toEqual([{ title: "Pick", message: 'Unknown view "nope". Available: none' }])
    dispose()
  })

  test("pick survives a throwing alert dialog", async () => {
    const ctx = fakeContext()
    ctx.ui.dialog.alert = () => Promise.reject(new Error("no dialog"))
    const { picker, dispose } = make(ctx)
    await expect(picker.pick("nope")).resolves.toBeUndefined()
    dispose()
  })

  test("pick without an argument opens the select dialog with selectable options", async () => {
    const ctx = fakeContext()
    ctx.selectValue = "zen"
    const { picker, dispose } = make(ctx, config({ selectable: (e) => e.id === "zen" }))
    await picker.pick()
    expect(ctx.selectCalls).toEqual([
      {
        title: "Pick",
        message: "choose",
        current: "go",
        options: [{ title: "Zen", value: "zen", description: "", disabled: false }],
      },
    ])
    expect(picker.currentID()).toBe("zen")
    dispose()
  })

  test("pick dialog options carry the entry description", async () => {
    const ctx = fakeContext()
    ctx.selectValue = "go"
    const { picker, dispose } = make(ctx)
    await picker.pick()
    expect((ctx.selectCalls[0] as { options: Array<{ description: string }> }).options[0]!.description).toBe("go view")
    dispose()
  })

  test("pick ignores a dialog selection with no matching entry", async () => {
    const ctx = fakeContext()
    ctx.selectValue = "gone"
    const { picker, dispose } = make(ctx)
    await picker.pick()
    expect(picker.currentID()).toBe("go")
    dispose()
  })

  test("pick survives a throwing select dialog", async () => {
    const ctx = fakeContext()
    ctx.ui.dialog.select = () => Promise.reject(new Error("no dialog"))
    const { picker, dispose } = make(ctx)
    await expect(picker.pick()).resolves.toBeUndefined()
    dispose()
  })

  test("registerCommand wires a keymap layer through an app slot", () => {
    const ctx = fakeContext()
    const { picker, dispose } = make(ctx)
    picker.registerCommand()

    expect(ctx.ui.slot).toHaveBeenCalledTimes(1)
    const slot = ctx.slotCalls[0]!
    expect(slot.append).toBe("app")

    // Render the slot: this registers the keymap layer.
    const renderResult = (slot.render as () => unknown)()
    expect(renderResult).toBeNull()
    expect(ctx.keymap.layer).toHaveBeenCalledTimes(1)

    const layer = ctx.layerCalls[0] as { mode: string; priority: number; commands: Array<Record<string, unknown>> }
    expect(layer.mode).toBe("global")
    expect(layer.priority).toBe(10)
    const cmd = layer.commands[0]! as Record<string, unknown> & {
      id: string
      slash: { name: string; arguments: boolean }
      title: string
      run: (input?: string) => void
    }
    expect(cmd.id).toBe("test.view")
    expect(cmd.slash).toEqual({ name: "test-view", arguments: true })
    expect(cmd.title).toBe("view: Go") // title evaluated with the current entry

    // run(input) routes into pick()
    void cmd.run("zen")
    dispose()
  })

  test("registerCommand survives a throwing keymap.layer", () => {
    const ctx = fakeContext()
    ctx.keymap.layer = () => {
      throw new Error("no keymap")
    }
    const { picker, dispose } = make(ctx)
    picker.registerCommand()
    const slot = ctx.slotCalls[0]!
    expect(() => (slot.render as () => unknown)()).not.toThrow()
    dispose()
  })

  test("registerCommand survives a throwing slot", () => {
    const ctx = fakeContext()
    ctx.ui.slot = () => {
      throw new Error("no slot")
    }
    const { picker, dispose } = make(ctx)
    expect(() => picker.registerCommand()).not.toThrow()
    dispose()
  })

  test("current() falls back to the first entry when the registry drops it", () => {
    const ctx = fakeContext()
    const reg: Option[] = [{ id: "solo", title: "Solo" }]
    const first = reg[0]
    const { picker, dispose } = make(ctx, config({ registry: reg }))
    picker.apply(first!)
    reg.pop()
    // registry.find() misses; `first` (captured at creation) is the fallback.
    expect(picker.current()).toBe(first)
    expect(picker.currentID()).toBe("solo")
    dispose()
  })

  test("command aliases and custom fields flow through", () => {
    const ctx = fakeContext()
    const { picker, dispose } = make(
      ctx,
      config({ command: { ...config().command, aliases: ["tv"], title: (c) => `t ${c.id}` } }),
    )
    picker.registerCommand()
    const slot = ctx.slotCalls[0]!
    ;(slot.render as () => unknown)()
    const layer = ctx.layerCalls[0] as { commands: Array<{ slash: { aliases?: string[] }; title: string }> }
    expect(layer.commands[0]!.slash.aliases).toEqual(["tv"])
    expect(layer.commands[0]!.title).toBe("t go")
    dispose()
  })
})
