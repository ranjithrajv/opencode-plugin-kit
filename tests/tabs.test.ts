import { describe, expect, test, vi } from "vitest"
import { createTabs } from "../src/tabs.ts"

function tabsContext(opts?: { tabs?: any }) {
  const tabs = opts?.tabs ?? {
    enabled: vi.fn(() => true),
    list: vi.fn(() => [
      { sessionID: "s1", title: "Session 1", active: true, busy: false },
      { sessionID: "s2", title: "Session 2", active: false, busy: true },
    ]),
    open: vi.fn(() => true),
    focus: vi.fn(() => true),
    move: vi.fn(() => true),
    close: vi.fn(() => true),
  }
  const context: any = { ui: { tabs } }
  return { context, tabs }
}

describe("createTabs", () => {
  test("returns a handle with all methods", () => {
    const { context } = tabsContext()
    const handle = createTabs(context)

    expect(typeof handle.enabled).toBe("function")
    expect(typeof handle.list).toBe("function")
    expect(typeof handle.active).toBe("function")
    expect(typeof handle.open).toBe("function")
    expect(typeof handle.focus).toBe("function")
    expect(typeof handle.move).toBe("function")
    expect(typeof handle.close).toBe("function")
    expect(typeof handle.isOpen).toBe("function")
  })

  test("enabled returns the host's tab support status", () => {
    const { context } = tabsContext()
    const handle = createTabs(context)
    expect(handle.enabled()).toBe(true)
  })

  test("list returns the current tabs", () => {
    const { context } = tabsContext()
    const handle = createTabs(context)
    const list = handle.list()
    expect(list).toHaveLength(2)
    expect(list[0].sessionID).toBe("s1")
    expect(list[1].sessionID).toBe("s2")
  })

  test("active returns the currently active tab", () => {
    const { context } = tabsContext()
    const handle = createTabs(context)
    expect(handle.active()?.sessionID).toBe("s1")
  })

  test("active returns undefined when no tabs exist", () => {
    const { context } = tabsContext({ tabs: { ...tabsContext().tabs, list: () => [] } })
    const handle = createTabs(context)
    expect(handle.active()).toBeUndefined()
  })

  test("open delegates to the host", () => {
    const { context, tabs } = tabsContext()
    const handle = createTabs(context)
    expect(handle.open("s3")).toBe(true)
    expect(tabs.open).toHaveBeenCalledWith("s3")
  })

  test("focus delegates to the host", () => {
    const { context, tabs } = tabsContext()
    const handle = createTabs(context)
    expect(handle.focus("s2")).toBe(true)
    expect(tabs.focus).toHaveBeenCalledWith("s2")
  })

  test("move delegates to the host", () => {
    const { context, tabs } = tabsContext()
    const handle = createTabs(context)
    expect(handle.move("s1", 2)).toBe(true)
    expect(tabs.move).toHaveBeenCalledWith("s1", 2)
  })

  test("close delegates to the host", () => {
    const { context, tabs } = tabsContext()
    const handle = createTabs(context)
    expect(handle.close("s1")).toBe(true)
    expect(tabs.close).toHaveBeenCalledWith("s1")
  })

  test("close without argument delegates as undefined", () => {
    const { context, tabs } = tabsContext()
    const handle = createTabs(context)
    handle.close()
    expect(tabs.close).toHaveBeenCalledWith(undefined)
  })

  test("isOpen checks whether a session has a tab", () => {
    const { context } = tabsContext()
    const handle = createTabs(context)
    expect(handle.isOpen("s1")).toBe(true)
    expect(handle.isOpen("s3")).toBe(false)
  })

  test("returns a no-op handle when the host has no tabs", () => {
    const context: any = { ui: {} }
    const handle = createTabs(context)

    expect(handle.enabled()).toBe(false)
    expect(handle.list()).toEqual([])
    expect(handle.active()).toBeUndefined()
    expect(handle.open("s1")).toBe(false)
    expect(handle.focus("s1")).toBe(false)
    expect(handle.move("s1", 0)).toBe(false)
    expect(handle.close("s1")).toBe(false)
    expect(handle.isOpen("s1")).toBe(false)
  })

  test("handles host methods that throw", () => {
    const context: any = {
      ui: {
        tabs: {
          enabled: () => {
            throw new Error("fail")
          },
          list: () => {
            throw new Error("fail")
          },
          open: () => {
            throw new Error("fail")
          },
          focus: () => {
            throw new Error("fail")
          },
          move: () => {
            throw new Error("fail")
          },
          close: () => {
            throw new Error("fail")
          },
        },
      },
    }
    const handle = createTabs(context)

    expect(handle.enabled()).toBe(false)
    expect(handle.list()).toEqual([])
    expect(handle.active()).toBeUndefined()
    expect(handle.open("s1")).toBe(false)
    expect(handle.focus("s1")).toBe(false)
    expect(handle.move("s1", 0)).toBe(false)
    expect(handle.close("s1")).toBe(false)
    expect(handle.isOpen("s1")).toBe(false)
  })

  test("active returns the first tab when none is marked active", () => {
    const context: any = {
      ui: {
        tabs: {
          enabled: () => true,
          list: () => [
            { sessionID: "s1", title: "Session 1", active: false },
            { sessionID: "s2", title: "Session 2", active: false },
          ],
        },
      },
    }
    const handle = createTabs(context)
    expect(handle.active()?.sessionID).toBe("s1")
  })

  test("active returns undefined when list throws", () => {
    const context: any = {
      ui: {
        tabs: {
          enabled: vi.fn(() => true),
          list: vi.fn(() => {
            throw new Error("fail")
          }),
        },
      },
    }
    const handle = createTabs(context)
    expect(handle.active()).toBeUndefined()
  })

  test("isOpen returns false when list throws", () => {
    const context: any = {
      ui: {
        tabs: {
          enabled: vi.fn(() => true),
          list: vi.fn(() => {
            throw new Error("fail")
          }),
        },
      },
    }
    const handle = createTabs(context)
    expect(handle.isOpen("s1")).toBe(false)
  })
})
