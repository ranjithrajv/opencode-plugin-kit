/** @jsxImportSource @opentui/solid */
// Collapsible sidebar sections — the header pattern shared by the skill
// lister and the plugin manager (both mirroring the built-in
// opencode.sidebar.mcp widget). One implementation keeps every sidebar
// section in lockstep with the built-in instead of drifting per plugin.
//
// Two shapes, matching the two patterns the plugins actually render:
//  - CollapsibleSection: the top-level block. Bold title, ▶/▼ arrow only
//    above `threshold` items, collapsed summary, content hidden while
//    collapsed (unless under the threshold).
//  - CollapsibleGroup: a nested group. Subdued ▸/▾ header with a trailing
//    count, always toggleable.
import { createSignal, Show } from "solid-js"
import type { JSX } from "solid-js"
import { usePlugin } from "@opencode/plugin/tui"

/**
 * Theme tokens a collapsible header needs. Derived from the host theme so
 * callers can pass their `usePlugin().theme` straight through, and so we
 * don't pin the host's color type (e.g. `RGBA`) here.
 */
type HostTheme = ReturnType<typeof usePlugin>["theme"]
export interface CollapsibleTheme {
  text: {
    base?: HostTheme["text"]["base"]
    muted?: HostTheme["text"]["muted"]
  }
}

/**
 * Resolve the theme for a header.
 *
 * Prefer an explicitly passed `theme`. When this package is consumed from
 * `node_modules`, `usePlugin()` here resolves a different copy of
 * `@opencode/plugin` (and `solid-js`) than the host renders with, so the
 * host's plugin context is not visible and `usePlugin()` throws
 * "PluginContextProvider is missing". Callers that already hold the host
 * context pass `theme` down; the `usePlugin()` fallback keeps working for
 * consumers whose module graph is deduped (tests, monorepos).
 */
function resolveTheme(explicit?: CollapsibleTheme): CollapsibleTheme {
  if (explicit) return explicit
  try {
    return usePlugin().theme
  } catch {
    return { text: {} }
  }
}

/** The top-level collapsible sidebar section. */
export function CollapsibleSection(props: {
  title: string
  /** Item count; drives the threshold and the default collapsed summary. */
  count?: number
  /** Collapsed summary text; defaults to the count in parentheses. */
  summary?: string
  /** The section only expands above this count. Defaults to 2. */
  threshold?: number
  /** Always-visible content between the header and the collapsible body
   * (e.g. the plugin manager's status note). */
  pinned?: JSX.Element
  /** Header colors; pass the host's `usePlugin().theme` from the consumer. */
  theme?: CollapsibleTheme
  children: JSX.Element
}) {
  const theme = resolveTheme(props.theme)
  const [expanded, setExpanded] = createSignal(false)
  const count = () => props.count ?? 0
  const threshold = () => props.threshold ?? 2
  const expandable = () => count() > threshold()
  return (
    <box flexDirection="column">
      <box flexDirection="row" gap={1} onMouseDown={() => expandable() && setExpanded((e) => !e)}>
        <Show when={expandable()}>
          <text fg={theme.text.base}>{expanded() ? "▼" : "▶"}</text>
        </Show>
        <text fg={theme.text.base}>
          <b>{props.title}</b>
        </text>
        <Show when={!expanded()}>
          <text fg={theme.text.muted}> ({props.summary ?? count()})</text>
        </Show>
      </box>
      {props.pinned}
      <Show when={!expandable() || expanded()}>{props.children}</Show>
    </box>
  )
}

/**
 * A collapsible group nested inside a section. Children may be a render
 * function receiving the reactive collapsed state — for content that must
 * react to the toggle without being hidden by it (the plugin manager's
 * built-ins hint).
 */
export function CollapsibleGroup(props: {
  title: string
  count: number
  defaultCollapsed?: boolean
  /** Header colors; pass the host's `usePlugin().theme` from the consumer. */
  theme?: CollapsibleTheme
  children: JSX.Element | ((collapsed: () => boolean) => JSX.Element)
}) {
  const theme = resolveTheme(props.theme)
  const [collapsed, setCollapsed] = createSignal(props.defaultCollapsed ?? false)
  return (
    <box flexDirection="column">
      <box flexDirection="row" gap={1} onMouseDown={() => setCollapsed((c) => !c)}>
        <text fg={theme.text.muted}>{collapsed() ? "▸" : "▾"}</text>
        <text fg={theme.text.muted}>
          {props.title} ({props.count})
        </text>
      </box>
      <Show when={!collapsed()}>
        {(() => {
          const children = props.children
          return typeof children === "function" && children.length > 0
            ? (children as (c: () => boolean) => JSX.Element)(collapsed)
            : (children as JSX.Element)
        })()}
      </Show>
    </box>
  )
}
