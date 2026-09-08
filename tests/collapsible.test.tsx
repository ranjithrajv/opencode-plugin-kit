// @vitest-environment happy-dom
import { describe, expect, test } from "vitest"
import { render } from "solid-js/web"
import { PluginContextProvider } from "@opencode-ai/plugin/tui"
import { createRoot } from "solid-js"
import { CollapsibleGroup, CollapsibleSection } from "../src/collapsible.tsx"

/** Render inside the plugin context provider (usePlugin needs it) and
 * return the container plus a click helper for the header. */
function mount(ui: () => any): { text: () => string; click: (el: HTMLElement) => void; dispose: () => void } {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const dispose = createRoot((dispose) => {
    render(
      () => (
        <PluginContextProvider value={{ theme: { text: { default: "#fff", subdued: "#888" } } } as any}>
          {ui()}
        </PluginContextProvider>
      ),
      container,
    )
    return dispose
  })
  return {
    text: () => container.textContent ?? "",
    click: (el) => el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })),
    dispose,
  }
}

function header(container: HTMLElement): HTMLElement {
  // The first row box is the header.
  return container.firstElementChild!.firstElementChild as HTMLElement
}

describe("CollapsibleSection", () => {
  test("bold title with the count while collapsed", () => {
    const m = mount(() => (
      <CollapsibleSection title="SKILLS" count={5}>
        <text>body</text>
      </CollapsibleSection>
    ))
    expect(m.text()).toContain("SKILLS")
    expect(m.text()).toContain("(5)")
    expect(m.text()).not.toContain("body")
    m.dispose()
  })

  test("expands on header click when above the threshold", () => {
    const m = mount(() => (
      <CollapsibleSection title="SKILLS" count={5}>
        <text>body</text>
      </CollapsibleSection>
    ))
    m.click(header(document.body.lastElementChild as HTMLElement))
    expect(m.text()).toContain("body")
    m.dispose()
  })

  test("shows content without an arrow at or below the threshold", () => {
    const m = mount(() => (
      <CollapsibleSection title="SKILLS" count={2}>
        <text>body</text>
      </CollapsibleSection>
    ))
    expect(m.text()).toContain("body")
    // No expand arrow: clicking the header must not hide the content.
    m.click(header(document.body.lastElementChild as HTMLElement))
    expect(m.text()).toContain("body")
    m.dispose()
  })

  test("renders pinned content even while collapsed", () => {
    const m = mount(() => (
      <CollapsibleSection title="PLUGINS" count={9} pinned={<text>note</text>}>
        <text>body</text>
      </CollapsibleSection>
    ))
    expect(m.text()).toContain("note")
    expect(m.text()).not.toContain("body")
    m.dispose()
  })

  test("uses the summary text when provided", () => {
    const m = mount(() => (
      <CollapsibleSection title="PLUGINS" count={9} summary="2 npm · 7 builtin">
        <text>body</text>
      </CollapsibleSection>
    ))
    expect(m.text()).toContain("(2 npm · 7 builtin)")
    m.dispose()
  })
})

describe("CollapsibleGroup", () => {
  test("title with count; children hidden until toggled", () => {
    const m = mount(() => (
      <CollapsibleGroup title="NPM" count={3}>
        <text>rows</text>
      </CollapsibleGroup>
    ))
    expect(m.text()).toContain("NPM (3)")
    expect(m.text()).not.toContain("rows")
    m.click(header(document.body.lastElementChild as HTMLElement))
    expect(m.text()).toContain("rows")
    m.dispose()
  })

  test("defaultCollapsed starts open only when asked", () => {
    const m = mount(() => (
      <CollapsibleGroup title="NPM" count={1} defaultCollapsed={false}>
        <text>rows</text>
      </CollapsibleGroup>
    ))
    expect(m.text()).toContain("rows")
    m.dispose()
  })

  test("the render-function children receive the live collapsed state", () => {
    const m = mount(() => (
      <CollapsibleGroup title="BUILT-IN" count={4}>
        {(collapsed) => (
          <>
            <Show2 when={collapsed()}>{<text>hint</text>}</Show2>
            <text>rows</text>
          </>
        )}
      </CollapsibleGroup>
    ))
    m.click(header(document.body.lastElementChild as HTMLElement))
    // Expanded: both the hint and the rows are visible.
    expect(m.text()).toContain("hint")
    expect(m.text()).toContain("rows")
    m.dispose()
  })
})

// Local Show stand-in so the hint test stays about the group contract, not
// about importing solid's Show into the fixture.
function Show2(props: { when: boolean; children: any }) {
  return props.when ? props.children : null
}
