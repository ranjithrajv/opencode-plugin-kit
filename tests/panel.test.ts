import { describe, expect, test, vi } from "vitest"
import { createPanel, type PanelInput } from "../src/panel.ts"

function panelContext(panel: Record<string, unknown> | undefined = {}) {
  const slots: Array<Record<string, unknown>> = []
  const toasts: Array<{ message: string; variant?: string }> = []
  const context: any = {
    ui: {
      slot: (options: Record<string, unknown>) => {
        slots.push(options)
        return () => {}
      },
      toast: { show: (input: { message: string; variant?: string }) => toasts.push(input) },
      ...(panel === undefined ? {} : { panel }),
    },
  }
  return { context, slots, toasts }
}

describe("createPanel", () => {
  test("claims the panel slot and filters renders by name", () => {
    const { context, slots } = panelContext()
    const render = vi.fn((input: PanelInput) => input.sessionID)
    const handle = createPanel(context, { name: "forensics", render })
    expect(slots[0]).toMatchObject({ append: "session.panel" })

    const slotRender = slots[0].render as (input: PanelInput) => unknown
    expect(slotRender({ name: "other", sessionID: "s" })).toBeNull()
    expect(render).not.toHaveBeenCalled()
    expect(slotRender({ name: "forensics", sessionID: "s" })).toBe("s")
    expect(handle.controller.input()).toMatchObject({ name: "forensics", sessionID: "s" })
    handle.cleanup()
  })

  test("reports the active panel and forwards host actions", () => {
    let current: { name?: string } | undefined = { name: "forensics" }
    const { context, slots } = panelContext({ current: () => current })
    const close = vi.fn()
    const toggle = vi.fn()
    const handle = createPanel(context, { name: "forensics", render: () => null })

    // No render yet: actions are no-ops.
    handle.controller.close()
    handle.controller.toggleFullscreen()
    expect(close).not.toHaveBeenCalled()

    ;(slots[0].render as (input: PanelInput) => unknown)({ name: "forensics", close, toggleFullscreen: toggle })
    handle.controller.close()
    handle.controller.toggleFullscreen()
    expect(close).toHaveBeenCalledOnce()
    expect(toggle).toHaveBeenCalledOnce()

    expect(handle.controller.isActive()).toBe(true)
    current = { name: "other" }
    expect(handle.controller.isActive()).toBe(false)
    current = undefined
    expect(handle.controller.isActive()).toBe(false)
  })

  test("opens by name with the requested presentation", () => {
    const open = vi.fn(() => true)
    const { context } = panelContext({ open })
    const handle = createPanel(context, { name: "forensics", render: () => null })
    handle.controller.open()
    handle.controller.open("panel")
    expect(open).toHaveBeenNthCalledWith(1, "forensics", { presentation: "fullscreen" })
    expect(open).toHaveBeenNthCalledWith(2, "forensics", { presentation: "panel" })
  })

  test("toasts when the host refuses or lacks a panel", () => {
    const refused = panelContext({ open: () => false })
    createPanel(refused.context, { name: "forensics", render: () => null }).controller.open()
    expect(refused.toasts[0]).toMatchObject({ variant: "warning" })

    const missing = panelContext(undefined)
    createPanel(missing.context, { name: "forensics", render: () => null }).controller.open()
    expect(missing.toasts[0]).toMatchObject({ variant: "warning" })

    const custom = panelContext(undefined)
    createPanel(custom.context, {
      name: "forensics",
      render: () => null,
      unavailableMessage: "no panel here",
    }).controller.open()
    expect(custom.toasts[0].message).toBe("no panel here")
  })

  test("reports open failures, with and without an error sink", () => {
    const onError = vi.fn()
    const failing = panelContext({
      open: () => {
        throw new Error("boom")
      },
    })
    createPanel(failing.context, { name: "forensics", render: () => null, onError }).controller.open()
    expect(onError).toHaveBeenCalledOnce()
    expect(failing.toasts[0]).toMatchObject({ message: "boom", variant: "error" })

    const thrown = panelContext({
      open: () => {
        throw "string failure"
      },
    })
    createPanel(thrown.context, { name: "forensics", render: () => null }).controller.open()
    expect(thrown.toasts[0]).toMatchObject({ message: "string failure", variant: "error" })
  })
})
