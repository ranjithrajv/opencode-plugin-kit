// Reactive connected-providers tracker for sidebar widgets.
//
// The usage-quota tracker gates views on "is this provider connected?" by
// polling the integration list with env-var fallbacks (e.g. HuggingFace's
// HF_TOKEN). Any plugin that shows per-provider views reimplements this —
// centralize it so the discovery source (integration list + auth.json +
// env fallbacks) lives in one place.
import { createSignal } from "solid-js"
import { connectedProviderIds } from "./schemas.ts"
import { hasKey } from "./providers.ts"
import type { KitContext } from "./host.ts"

export interface ConnectedProvidersOptions {
  /** Extra providers to treat as connected (e.g. env-var-only providers). */
  readonly extra?: (() => string[]) | string[]
  /** Polling interval in ms. Defaults to 30_000. Set to 0 to disable. */
  readonly pollMs?: number
}

export interface ConnectedProviders {
  /** Reactive set of connected provider ids. */
  readonly ids: () => Set<string>
  /** Whether a specific provider is connected. */
  readonly has: (providerID: string) => boolean
  /** Force an immediate refresh. */
  readonly refresh: () => Promise<void>
  /** Stop polling (call from cleanup). */
  readonly stop: () => void
}

/**
 * Track which providers are connected. Reads the integration list (same
 * source /connect uses) on a timer, falling back to auth.json when the
 * client is unavailable. Extra providers (e.g. env-var-only) are always
 * included.
 */
export function createConnectedProviders(
  context: KitContext,
  options: ConnectedProvidersOptions = {},
): ConnectedProviders {
  const [ids, setIds] = createSignal<Set<string>>(new Set())

  const extra = (): string[] => {
    const e = options.extra
    if (!e) return []
    if (typeof e === "function") return e()
    return e
  }

  async function refresh(): Promise<void> {
    try {
      const res = await context.client.integration.list()
      const next = connectedProviderIds(res)
      // Merge in extras.
      for (const id of extra()) next.add(id)
      setIds(next)
    } catch {
      // Client unavailable: fall back to auth.json.
      const fallback = new Set<string>()
      // Read from the integration list failed; use auth.json keys.
      // hasKey reads auth.json defensively.
      for (const id of extra()) if (hasKey(id)) fallback.add(id)
      setIds(fallback)
    }
  }

  // Initial refresh.
  void refresh()

  // Optional polling.
  const pollMs = options.pollMs ?? 30_000
  let timer: ReturnType<typeof setInterval> | null = null
  if (pollMs > 0) {
    timer = setInterval(() => void refresh(), pollMs)
  }

  return {
    ids,
    has: (providerID: string) => ids().has(providerID),
    refresh,
    stop: () => {
      if (timer !== null) {
        clearInterval(timer)
        timer = null
      }
    },
  }
}
