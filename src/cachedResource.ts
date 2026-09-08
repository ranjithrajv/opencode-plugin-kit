// Stale-while-revalidate resource: combines createResource + createCachedStore
// into one primitive so sidebar widgets restore instantly from cache, then
// refresh in the background.
//
// Both the model recommender and skill-lister hand-wire "serve cache, refresh
// behind it" — this encapsulates that dance.
import { createResource } from "solid-js"
import type { CachedStore } from "./cache.ts"

export interface CachedResourceOptions<T> {
  /** Durable cache (from createCachedStore). */
  readonly cache: CachedStore<T | null>
}

/**
 * Create a cached resource that serves the cache instantly, then refetches
 * in the background. The cache persists across TUI restarts so the sidebar
 * never shows a loading state.
 *
 * @example
 * const cache = createCachedStore(context, "picks", { initial: null, staleAfterMs: 300_000 })
 * const cached = createCachedResource(() => sessionID, loadPicks, { cache })
 * // cached.data() — the resource signal
 * // cached.refetch() — force a refetch
 * // cached.set(value) — mutate both resource + cache
 */
export function createCachedResource<T>(
  source: () => string | undefined,
  loader: (sid: string | undefined) => Promise<T>,
  options: CachedResourceOptions<T>,
) {
  const { cache } = options

  const [data, { refetch, mutate }] = createResource(
    source,
    async (sid) => {
      const result = await loader(sid)
      cache.set(result)
      return result
    },
    { initialValue: (cache.value ?? undefined) as T | undefined },
  )

  return {
    data,
    refetch: () => {
      if (cache.stale) void refetch()
    },
    // Unconditional refetch — for after external changes (e.g. a config file
    // edited on disk) where the staleness gate would wrongly skip the reload.
    refetchNow: () => refetch(),
    set: (value: T) => {
      cache.set(value)
      // Setter<T> overloads don't resolve for bare generics; cast through unknown.
      ;(mutate as (v: T) => void)(value)
    },
  }
}
