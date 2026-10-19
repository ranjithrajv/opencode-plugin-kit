// Composer slot helpers.
//
// Plugins that augment the input composer (autocomplete hints, context
// previews, model-specific prompts) repeat the same wiring: claim the
// `session.composer.top` slot, render reactively, and handle hosts that
// lack the slot. This module owns that pattern.
import type { KitContext } from "./host.ts"
import { claimSlot } from "./slot.ts"

/** The input the host passes to a `session.composer.top` render. */
export interface ComposerInput {
  readonly sessionID?: string
}

export interface ComposerOptions {
  /** Render the composer augmentation. Receives the slot input reactively. */
  readonly render: (input: ComposerInput | undefined) => unknown
  /** Called when the host throws while claiming the slot. */
  readonly onError?: (error: unknown) => void
}

export interface ComposerHandle {
  /** The cleanup function returned by `claimSlot`. */
  readonly cleanup: () => void
  /** The last render input, if any. */
  readonly input: () => ComposerInput | undefined
}

/**
 * Claim the `session.composer.top` slot. The slot is claimed immediately so
 * a failed claim can never be delayed by later setup work. Never throws.
 */
export function createComposer(context: KitContext, options: ComposerOptions): ComposerHandle {
  let last: ComposerInput | undefined

  const cleanup = claimSlot(context, {
    append: "session.composer.top",
    render: (input) => {
      const composer = input as ComposerInput | undefined
      last = composer
      return options.render(composer)
    },
    onError: options.onError,
  })

  return {
    cleanup,
    input: () => last,
  }
}
