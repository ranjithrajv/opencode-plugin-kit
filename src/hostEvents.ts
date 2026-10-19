// Host event subscription with a polling fallback.
//
// Live widgets want instant updates from host events, but older hosts do not
// emit any. This subscribes to as many event types as the host knows, then
// keeps a heartbeat interval: slow when events work, fast when they do not.
import type { KitContext } from "./host.ts"

export interface HostEventsOptions {
  /** Event names to subscribe to (unknown ones are skipped). */
  readonly types: readonly string[]
  /** Called on every event, and on each heartbeat tick. */
  readonly onEvent: () => void
  /** Heartbeat interval when the host emits events. Defaults to 10s. */
  readonly heartbeatMs?: number
  /** Interval when the host emits no events. Defaults to 1s. */
  readonly fallbackMs?: number
}

export interface HostEvents {
  /** True when the host accepted at least one event subscription. */
  readonly live: () => boolean
  /** Stop the heartbeat and unsubscribe every listener. Safe to call twice. */
  readonly stop: () => void
}

/**
 * Subscribe to host data events and start a heartbeat. The timer reference is
 * internal; `stop()` is the only teardown callers need.
 */
export function createHostEvents(context: KitContext, options: HostEventsOptions): HostEvents {
  const offs: Array<() => void> = []
  for (const type of options.types) {
    try {
      const off = context?.data?.on?.(type, options.onEvent)
      if (typeof off === "function") offs.push(off)
    } catch {
      // This host does not know the event; the fallback interval covers it.
    }
  }
  const live = offs.length > 0
  const timer = setInterval(options.onEvent, live ? (options.heartbeatMs ?? 10_000) : (options.fallbackMs ?? 1000))
  let stopped = false

  return {
    live: () => live,
    stop: () => {
      if (stopped) return
      stopped = true
      clearInterval(timer)
      for (const off of offs) {
        try {
          off()
        } catch {
          // A host that throws on unsubscribe is already gone.
        }
      }
    },
  }
}
