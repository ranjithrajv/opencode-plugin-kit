import { describe, expect, test, vi } from "vitest"
import { paletteCommand, registerPaletteCommand, registerPaletteGroup, dynamicPaletteCommand } from "../src/palette.ts"
import type { KitCommandEntry } from "../src/host.ts"

function paletteContext() {
  const layerCalls: unknown[] = []
  const slotCalls: Array<Record<string, unknown>> = []
  const context: any = {
    ui: {
      slot: (options: Record<string, unknown>) => {
        slotCalls.push(options)
        return () => {}
      },
    },
    keymap: {
      layer: (register: () => unknown) => {
        layerCalls.push(register())
      },
    },
  }
  return { context, layerCalls, slotCalls }
}

describe("paletteCommand", () => {
  test("builds a complete palette command entry", () => {
    const entry = paletteCommand({
      id: "my.command",
      title: "My Command",
      description: "Does something",
      group: "My Plugin",
      run: () => {},
    })

    expect(entry.id).toBe("my.command")
    expect(entry.title).toBe("My Command")
    expect(entry.description).toBe("Does something")
    expect(entry.group).toBe("My Plugin")
    expect(entry.palette).toBe(true)
    expect(entry.run).toBeTypeOf("function")
  })

  test("includes slash config when provided", () => {
    const entry = paletteCommand({
      id: "my.command",
      title: "My Command",
      slash: { name: "my-cmd", aliases: ["mc"], arguments: true },
      run: () => {},
    })

    expect(entry.slash).toEqual({ name: "my-cmd", aliases: ["mc"], arguments: true })
  })

  test("sets palette to true by default", () => {
    const entry = paletteCommand({
      id: "my.command",
      title: "My Command",
      run: () => {},
    })
    expect(entry.palette).toBe(true)
  })

  test("can disable palette", () => {
    const entry = paletteCommand({
      id: "my.command",
      title: "My Command",
      palette: false,
      run: () => {},
    })
    expect(entry.palette).toBe(false)
  })
})

describe("registerPaletteCommand", () => {
  test("registers through an app slot keymap layer", () => {
    const { context, slotCalls, layerCalls } = paletteContext()
    const run = vi.fn()
    registerPaletteCommand(context, {
      id: "my.command",
      title: "My Command",
      run,
    })

    expect(slotCalls).toHaveLength(1)
    expect(slotCalls[0]).toMatchObject({ append: "app" })

    // The slot render triggers the keymap layer registration.
    const slotRender = slotCalls[0].render as () => unknown
    slotRender()
    expect(layerCalls).toHaveLength(1)
    const layer = layerCalls[0] as { commands: KitCommandEntry[] }
    expect(layer.commands).toHaveLength(1)
    expect(layer.commands[0].id).toBe("my.command")
    expect(layer.commands[0].run).toBe(run)
  })

  test("does not throw when host lacks keymap support", () => {
    const context: any = { ui: { slot: () => () => {} }, keymap: {} }
    expect(() => registerPaletteCommand(context, { id: "x", title: "X", run: () => {} })).not.toThrow()
  })
})

describe("registerPaletteGroup", () => {
  test("registers multiple commands under one group in a single layer", () => {
    const { context, slotCalls, layerCalls } = paletteContext()
    registerPaletteGroup(context, {
      group: "My Plugin",
      commands: [
        { id: "cmd.1", title: "Command 1", run: () => {} },
        { id: "cmd.2", title: "Command 2", run: () => {} },
      ],
    })

    expect(slotCalls).toHaveLength(1)
    const slotRender = slotCalls[0].render as () => unknown
    slotRender()
    expect(layerCalls).toHaveLength(1)
    const layer = layerCalls[0] as { commands: KitCommandEntry[] }
    expect(layer.commands).toHaveLength(2)
    expect(layer.commands[0].group).toBe("My Plugin")
    expect(layer.commands[1].group).toBe("My Plugin")
  })
})

describe("dynamicPaletteCommand", () => {
  test("evaluates title factory with current state", () => {
    const entry = dynamicPaletteCommand(
      {
        id: "my.command",
        title: (count?: number) => `Items: ${count ?? 0}`,
        run: () => {},
      },
      () => 42,
    )
    expect(entry.title).toBe("Items: 42")
  })

  test("works without a state getter", () => {
    const entry = dynamicPaletteCommand({
      id: "my.command",
      title: () => "Static",
      run: () => {},
    })
    expect(entry.title).toBe("Static")
  })

  test("applies the group name to commands without their own group", () => {
    const { context, slotCalls, layerCalls } = paletteContext()
    registerPaletteGroup(context, {
      group: "My Plugin",
      commands: [
        { id: "cmd.1", title: "Command 1", run: () => {} },
        { id: "cmd.2", title: "Command 2", run: () => {}, group: "Custom" },
      ],
    })

    const slotRender = slotCalls[0].render as () => unknown
    slotRender()
    const layer = layerCalls[0] as { commands: KitCommandEntry[] }
    expect(layer.commands[0].group).toBe("My Plugin")
    expect(layer.commands[1].group).toBe("Custom")
  })

  test("does not throw when keymap.layer throws", () => {
    const renders: Array<() => unknown> = []
    const context: any = {
      ui: {
        slot: (opts: Record<string, unknown>) => {
          renders.push(opts.render as () => unknown)
          return () => {}
        },
      },
      keymap: {
        layer: () => {
          throw new Error("keymap unavailable")
        },
      },
    }
    registerPaletteGroup(context, {
      group: "Test",
      commands: [{ id: "cmd.1", title: "Command 1", run: () => {} }],
    })
    // Invoke the slot render to trigger the keymap.layer throw path.
    expect(() => renders[0]()).not.toThrow()
  })

  test("does not throw when ui.slot throws", () => {
    const context: any = {
      ui: {
        slot: () => {
          throw new Error("slot unavailable")
        },
      },
    }
    expect(() =>
      registerPaletteGroup(context, {
        group: "Test",
        commands: [{ id: "cmd.1", title: "Command 1", run: () => {} }],
      }),
    ).not.toThrow()
  })
})
