// Status bar / footer slot claiming.
//
// Plugins that display persistent information (usage counters, connection
// status, model info) repeat the same wiring: claim a footer slot, handle
// hosts that lack it, render reactively, and clean up on unload. This module
// owns that pattern for the `home.footer`, `home.footer.status`,
// `prompt.footer`, `prompt.footer.status`, and `prompt.footer.file` slots.
import type { KitContext } from "./host.ts"
import { claimSlot } from "./slot.ts"

/** Known statusbar / footer slot paths. */
export type StatusbarSlot =
  | "home.footer"
  | "home.footer.status"
  | "prompt.footer"
  | "prompt.footer.status"
  | "prompt.footer.file"

export interface StatusbarOptions {
  /** Which footer slot to claim. */
  readonly slot: StatusbarSlot
  /** Render the footer content. Receives the slot input reactively. */
  readonly render: (input: Record<string, unknown> | undefined) => unknown
  /** Called when the host throws while claiming the slot. */
  readonly onError?: (error: unknown) => void
}

export interface StatusbarHandle {
  /** The cleanup function returned by `claimSlot`. */
  readonly cleanup: () => void
  /** The slot path this statusbar claimed. */
  readonly slot: StatusbarSlot
}

/**
 * Claim a footer/statusbar slot. The slot is claimed immediately so a failed
 * claim can never be delayed by later setup work. Never throws.
 */
export function createStatusbar(context: KitContext, options: StatusbarOptions): StatusbarHandle {
  const cleanup = claimSlot(context, {
    append: options.slot,
    render: options.render,
    onError: options.onError,
  })

  return {
    cleanup,
    slot: options.slot,
  }
}
