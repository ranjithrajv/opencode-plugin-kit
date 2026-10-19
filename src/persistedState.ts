// Reactive persisted state for panels and filters.
//
// `createCachedStore` is non-reactive and `createToggle` is a boolean, leaving
// a gap for "a durable object the UI edits" (collapsed flags, severity filters,
// selected category). This fills it: the host's reactive memory store when
// present, a storage-backed signal otherwise, and an in-memory signal as the
// last resort.
import { createSignal } from "solid-js"
import type { KitContext } from "./host.ts"

export interface PersistedState<T extends object> {
  /** Reactive current value. */
  readonly state: () => T
  /** Mutate a draft in place; the change is persisted and re-renders. */
  readonly update: (mutate: (draft: T) => void) => void
}

function clone<T>(value: T): T {
  try {
    return structuredClone(value)
  } catch {
    // Functions/symbols cannot be structured-cloned; a shallow copy is enough
    // for the plain UI state this helper is meant to hold.
    return { ...value }
  }
}

/**
 * Create a reactive object persisted under `key`. The mutation signature
 * matches the host's own stores, so callers do not care which backend won.
 */
export function createPersistedState<T extends object>(
  context: KitContext,
  key: string,
  initial: T,
): PersistedState<T> {
  const storage = context?.storage as
    | {
        memory?: (key: string, opts: { initial: T }) => [T, (mutation: (draft: T) => void) => void | Promise<void>]
        store?: (key: string, opts: { initial: T }) => [T, T]
      }
    | undefined

  // Preferred: the host exposes a reactive memory store.
  if (typeof storage?.memory === "function") {
    try {
      const [store, setStore] = storage.memory(key, { initial })
      return {
        state: () => store,
        update: (mutate) => {
          void setStore(mutate)
        },
      }
    } catch {
      // Fall through to the durable/plain store.
    }
  }

  // Solid's setter overloads narrow `T extends object`; the values here are
  // always the object type, so widen the accessor tuple explicitly.
  const [state, setState] = createSignal<T>(initial as never) as unknown as [
    () => T,
    (value: T | ((prev: T) => T)) => T,
  ]

  // Durable cell: read once, then mirror mutations back into the live cell.
  if (typeof storage?.store === "function") {
    try {
      const [store] = storage.store(key, { initial })
      if (store && typeof store === "object") {
        setState(store)
        return {
          state,
          update: (mutate) => {
            const draft = clone(state())
            mutate(draft)
            setState(draft)
            Object.assign(store, draft)
          },
        }
      }
    } catch {
      // Fall through to the in-memory signal.
    }
  }

  return {
    state,
    update: (mutate) => {
      const draft = clone(state())
      mutate(draft)
      setState(draft)
    },
  }
}
