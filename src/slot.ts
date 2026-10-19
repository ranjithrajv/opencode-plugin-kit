// Safe slot claiming.
//
// Every plugin wraps `ui.slot(...)` in the same try/catch: a host that lacks a
// slot must render nothing, not throw out of `setup()`. This centralizes that
// contract and guarantees a callable cleanup.
import type { KitSlotOptions } from "./host.ts"

export interface ClaimSlotOptions extends KitSlotOptions {
  /** Optional sink for hosts that throw while claiming (e.g. a plugin logger). */
  onError?: (error: unknown) => void
}

type SlotHost = {
  readonly ui?: {
    readonly slot?: (options: KitSlotOptions) => unknown
  }
}

/**
 * Claim a UI slot. Returns the host cleanup when it supplied one, otherwise a
 * no-op. Never throws.
 */
export function claimSlot(context: SlotHost, options: ClaimSlotOptions): () => void {
  const { onError, ...slot } = options
  try {
    const cleanup = context?.ui?.slot?.(slot)
    return typeof cleanup === "function" ? (cleanup as () => void) : () => {}
  } catch (error) {
    onError?.(error)
    return () => {}
  }
}
