/** @jsxImportSource @opentui/solid */
import { afterAll, describe, expect, test } from "vitest"
import { ensureRuntimePluginSupport } from "@opentui/solid/runtime-plugin-support/configure"

ensureRuntimePluginSupport()

const { testRender } = await import("@opentui/solid")
const solid = await import("solid-js")
const { createSignal, For, Show } = solid
// Force the SHIPPED artifact (pre-built dist), not the TS source — that's the
// code path the production host actually uses from node_modules.
const kit = await import("../dist/collapsible.js")

describe("Collapsible (OpenTUI: real mouse toggle)", () => {
  async function mount() {
    const t = await testRender(
      () => (
        <kit.CollapsibleSection title="SKILLS" count={4} theme={{ text: { base: "#fff", muted: "#888" } } as any}>
          <kit.CollapsibleGroup title="GROUP" count={2} theme={{ text: { base: "#fff", muted: "#888" } } as any}>
            {["x", "y"].map((s) => (
              <text key={s}>• {s}</text>
            ))}
          </kit.CollapsibleGroup>
        </kit.CollapsibleSection>
      ),
      { width: 40, height: 12 },
    )
    return t
  }

  test("initially collapsed, then expands on click", async () => {
    const t = await mount()
    try {
      await t.flush()
      const initial = t.captureCharFrame()
      expect(initial).toContain("▶")
      expect(initial).toContain("(4)")
      await t.mockMouse.click(4, 0)
      await t.flush()
      const after = t.captureCharFrame()
      expect(after).toContain("▼")
      expect(after).toContain("• x")
      expect(after).toContain("• y")
      await t.mockMouse.click(4, 0)
      await t.flush()
      expect(t.captureCharFrame()).toContain("▶")
    } finally {
      t.renderer.destroy()
    }
  })
})
EOF
