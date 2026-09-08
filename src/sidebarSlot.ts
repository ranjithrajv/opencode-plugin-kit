// Session-reactive data resource for sidebar slots.
//
// All three plugins register a sidebar slot and render the same
// "error fallback → loading fallback → happy path" pattern. The data
// loading is always keyed on sessionID and always needs loading/error
// accessors. This hook encapsulates that so plugins register the slot
// themselves (position is trivial) but get the resource lifecycle free.
import { createResource } from "solid-js"

/**
 * Create a session-reactive resource for a sidebar slot. The resource
 * refetches whenever `sessionID` changes. Returns the resource + refetch
 * so the plugin renders error/loading/happy states in JSX.
 *
 * @example
 * // In the plugin's tui.tsx setup():
 * const data = createSessionResource(() => props.sessionID, (sid) => fetchUsage(sid))
 *
 * return context.ui.slot({
 *   after: "sidebar.content",
 *   render: () => (
 *     <Show when={!data.data.error} fallback={<text>⚠ failed</text>}>
 *       <Show when={data.data()} fallback={<text>loading…</text>}>
 *         {(d) => <UsageView data={d()} />}
 *       </Show>
 *     </Show>
 *   ),
 * })
 */
export function createSessionResource<T>(
  sessionID: () => string | undefined,
  loader: (sessionID: string | undefined) => Promise<T | null>,
) {
  const [data, { refetch }] = createResource(sessionID, async (sid) => {
    const result = await loader(sid)
    return result === null ? undefined : result
  })

  return { data, refetch }
}
