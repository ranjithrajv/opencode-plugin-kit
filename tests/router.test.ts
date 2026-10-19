import { describe, expect, test, vi } from "vitest"
import { createPage, navigateTo, currentRoute } from "../src/router.ts"

function routerContext(route?: { type: string; id?: string; name?: string }) {
  const registrations: Array<{ name: string }> = []
  const navigations: Array<Record<string, unknown>> = []
  let current = route

  const context: any = {
    ui: {
      router: {
        register(page: { name: string }) {
          registrations.push(page)
          return () => {}
        },
        navigate(dest: Record<string, unknown>) {
          navigations.push(dest)
        },
        current() {
          return current
        },
      },
    },
  }
  return {
    context,
    registrations,
    navigations,
    setCurrent: (r: any) => {
      current = r
    },
  }
}

describe("createPage", () => {
  test("registers the page and returns a handle", () => {
    const { context, registrations } = routerContext()
    const render = vi.fn(() => null)
    const handle = createPage(context, { name: "my.settings", render })

    expect(registrations).toHaveLength(1)
    expect(registrations[0].name).toBe("my.settings")
    expect(typeof handle.cleanup).toBe("function")
    expect(typeof handle.navigate).toBe("function")
    expect(typeof handle.isActive).toBe("function")
    expect(typeof handle.current).toBe("function")
  })

  test("navigate sends the correct destination", () => {
    const { context, navigations } = routerContext()
    const handle = createPage(context, { name: "my.settings", render: () => null })
    handle.navigate()

    expect(navigations).toHaveLength(1)
    expect(navigations[0]).toMatchObject({ type: "plugin", id: "my.settings", name: "my.settings" })
  })

  test("navigate includes page data when provided", () => {
    const { context, navigations } = routerContext()
    const handle = createPage(context, { name: "my.settings", render: () => null, data: { tab: "general" } })
    handle.navigate()

    expect(navigations[0]).toMatchObject({ data: { tab: "general" } })
  })

  test("isActive returns true when the page is the current route", () => {
    const { context, setCurrent } = routerContext({ type: "plugin", id: "my.settings", name: "My Settings" })
    const handle = createPage(context, { name: "my.settings", render: () => null })

    expect(handle.isActive()).toBe(true)
    setCurrent({ type: "home" })
    expect(handle.isActive()).toBe(false)
    setCurrent(undefined)
    expect(handle.isActive()).toBe(false)
  })

  test("current returns the route info from the host", () => {
    const { context, setCurrent } = routerContext({ type: "session", sessionID: "s1" })
    const handle = createPage(context, { name: "my.settings", render: () => null })

    expect(handle.current()).toMatchObject({ type: "session", sessionID: "s1" })
    setCurrent({ type: "plugin", id: "other", name: "Other" })
    expect(handle.current()).toMatchObject({ type: "plugin", id: "other" })
  })

  test("returns a no-op handle when the host has no router", () => {
    const context: any = { ui: {} }
    const handle = createPage(context, { name: "my.settings", render: () => null })

    expect(handle.cleanup).toBeTypeOf("function")
    expect(() => handle.cleanup()).not.toThrow()
    expect(() => handle.navigate()).not.toThrow()
    expect(handle.isActive()).toBe(false)
    expect(handle.current()).toBeUndefined()
  })

  test("handles router methods that throw", () => {
    const context: any = {
      ui: {
        router: {
          register: () => () => {},
          navigate: () => {
            throw new Error("nav failed")
          },
          current: () => {
            throw new Error("current failed")
          },
        },
      },
    }
    const handle = createPage(context, { name: "my.settings", render: () => null })

    expect(() => handle.navigate()).not.toThrow()
    expect(handle.isActive()).toBe(false)
    expect(handle.current()).toBeUndefined()
  })
})

describe("navigateTo", () => {
  test("navigates to a plugin page by name", () => {
    const { context, navigations } = routerContext()
    navigateTo(context, "my.settings")
    expect(navigations).toHaveLength(1)
    expect(navigations[0]).toMatchObject({ type: "plugin", id: "my.settings", name: "my.settings" })
  })

  test("includes optional data", () => {
    const { context, navigations } = routerContext()
    navigateTo(context, "my.settings", { tab: "advanced" })
    expect(navigations[0]).toMatchObject({ data: { tab: "advanced" } })
  })

  test("does nothing when the host has no router", () => {
    const context: any = { ui: {} }
    expect(() => navigateTo(context, "my.settings")).not.toThrow()
  })

  test("does nothing when navigate throws", () => {
    const context: any = {
      ui: {
        router: {
          navigate: () => {
            throw new Error("fail")
          },
        },
      },
    }
    expect(() => navigateTo(context, "my.settings")).not.toThrow()
  })
})

describe("currentRoute", () => {
  test("returns the current route", () => {
    const { context } = routerContext({ type: "home" })
    expect(currentRoute(context)).toMatchObject({ type: "home" })
  })

  test("returns undefined when the host has no router", () => {
    const context: any = { ui: {} }
    expect(currentRoute(context)).toBeUndefined()
  })

  test("returns undefined when current() throws", () => {
    const context: any = {
      ui: {
        router: {
          current: () => {
            throw new Error("fail")
          },
        },
      },
    }
    expect(currentRoute(context)).toBeUndefined()
  })
})
