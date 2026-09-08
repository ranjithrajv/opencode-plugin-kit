// Storage-backed cache for sidebar widgets: instant restore of the last
import type { KitContext } from "./host.ts"
// known value across TUI restarts, with staleness tracking.

export interface CachedStore<T> {
  /** Last cached value (restored from plugin storage on restart), or the
   * `initial` when nothing has been cached yet. */
  readonly value: T
  /** Epoch ms of the last successful `set`. 0 when never set. */
  readonly lastSet: number
  /** True when `staleAfterMs` has elapsed since the last set (or nothing
   * was ever set). */
  readonly stale: boolean
  /** Cache a value and persist it. */
  set(value: T): void
}

interface CacheEntry<T> {
  value: T
  at: number
}

/**
 * Module-scope, storage-backed cache. Sidebar slots render synchronously, so
 * the latest successful fetch is what gets painted and a background refresher
 * keeps it fresh — this encapsulates that pattern:
 *
 *   const cache = createCachedStore(context, "usage", { initial: null, staleAfterMs: 120_000 })
 *   cache.set(fresh)                    // after a successful fetch
 *   render(cache.value)                 // instant, even after restart
 *   if (cache.stale) void refetch()     // background refresh
 */
export function createCachedStore<T>(
  context: KitContext,
  key: string,
  { initial, staleAfterMs }: { initial: T; staleAfterMs: number },
): CachedStore<T> {
  let value = initial
  let at = 0
  let persist: ((entry: CacheEntry<T>) => void) | null = null

  // Restore the last known value so a TUI restart shows data immediately
  // instead of a loading/empty state. Storage unavailable → memory-only.
  try {
    const [store] = context.storage.store(key, { initial: { entry: null as CacheEntry<T> | null } })
    if (store.entry) {
      value = store.entry.value
      at = store.entry.at
    }
    persist = (entry) => {
      store.entry = entry
    }
  } catch {
    // No storage; cache stays in-memory only.
  }

  return {
    get value() {
      return value
    },
    get lastSet() {
      return at
    },
    get stale() {
      return at === 0 || Date.now() - at > staleAfterMs
    },
    set(next: T) {
      value = next
      at = Date.now()
      persist?.({ value: next, at })
    },
  }
}

/**
 * Durable storage cell shared by the picker and the toggle: read the
 * persisted object (or undefined when storage is unavailable) and persist
 * by mutating it — the host hands back a live cell, so mutation = write.
 */
export function persistedCell<T extends object>(context: KitContext, storageKey: string, initial: T) {
  const read = (): T | undefined => {
    try {
      return (context.storage.store(storageKey, { initial }) as [T, T])?.[0]
    } catch {
      return undefined
    }
  }
  return {
    read,
    persist: (mutate: (value: T) => void): void => {
      const value = read()
      if (value) mutate(value)
    },
  }
}
