// Guards examples/hello-plugin from rot.
//
// The example imports the kit by package name, exactly as a real consumer
// would, so it must stay valid: it is typechecked (tsconfig includes
// `examples/`) and, here, actually executed. A drifting example is worse than
// no example, because it teaches the wrong thing.
import { describe, expect, test } from "vitest"
import { createRoot } from "solid-js"
import plugin from "../examples/hello-plugin/index.ts"
import { fakeContext } from "./testkit.ts"

describe("examples/hello-plugin", () => {
  test("exports a plugin definition", () => {
    expect(plugin.id).toBe("hello")
    expect(plugin.name).toBe("Hello")
    expect(typeof plugin.setup).toBe("function")
  })

  test("setup runs against a host context, renders, and cleans up", () => {
    const context = fakeContext()

    const cleanup = createRoot((dispose) => {
      const result = plugin.setup(context as never)

      // It claims the sidebar footer and its render produces text.
      const slot = (context.slotCalls as Array<Record<string, unknown>>).find(
        (call) => call.append === "sidebar.footer",
      )
      expect(slot, "example claims sidebar.footer").toBeTruthy()
      const output = (slot!.render as () => { type?: string; content?: string })()
      expect(output.type).toBe("text")
      expect(output.content).toContain("Hello")
      expect(output.content).toContain("tokens")

      dispose()
      return result
    })

    expect(cleanup).toBeTypeOf("function")
    expect(() => cleanup?.()).not.toThrow()
  })
})
