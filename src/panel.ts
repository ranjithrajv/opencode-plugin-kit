// Full-screen panel plumbing.
//
// A panel plugin repeats the same wiring every time: claim `session.panel`,
// ignore renders for other panels, capture the host's close/fullscreen
// callbacks, open by name, and report a host that has no panel UI. This module
// owns that pattern; the plugin keeps only its render tree.
import type { KitContext } from "./host.ts"
import { claimSlot } from "./slot.ts"
import { showToast } from "./toast.ts"

/** The input the host passes to a `session.panel` render. */
export interface PanelInput {
  readonly name?: string
  readonly sessionID?: string
  readonly width?: number
  readonly presentation?: "panel" | "fullscreen"
  readonly focused?: boolean
  /** Ask the host to move keyboard focus into the panel. */
  readonly focus?: () => void
  readonly close?: () => void
  readonly toggleFullscreen?: () => void
}

export interface PanelOptions {
  /** Panel id registered with the host, e.g. "forensics". */
  readonly name: string
  /** Render the panel body. Called only when `input.name` matches. */
  readonly render: (input: PanelInput) => unknown
  /** Toast shown when the host has no panel UI. */
  readonly unavailableMessage?: string
  /** Called when opening throws (e.g. logging). */
  readonly onError?: (error: unknown) => void
}

export interface PanelController {
  /** Open the panel; defaults to fullscreen. */
  readonly open: (presentation?: "panel" | "fullscreen") => void
  /** Close the panel through the host's captured callback. */
  readonly close: () => void
  /** Toggle fullscreen through the host's captured callback. */
  readonly toggleFullscreen: () => void
  /** True while the host's current panel is this one. */
  readonly isActive: () => boolean
  /** The last matching render input, if any. */
  readonly input: () => PanelInput | undefined
}

export interface PanelHandle {
  readonly controller: PanelController
  readonly cleanup: () => void
}

/**
 * Claim this plugin's `session.panel` contribution and expose an imperative
 * controller. The slot is claimed immediately so a failed claim can never be
 * delayed by later setup work.
 */
export function createPanel(context: KitContext, options: PanelOptions): PanelHandle {
  let last: PanelInput | undefined

  const cleanup = claimSlot(context, {
    append: "session.panel",
    render: (input) => {
      const panel = input as PanelInput | undefined
      if (panel?.name !== options.name) return null
      last = panel
      return options.render(panel)
    },
  })

  const open = (presentation: "panel" | "fullscreen" = "fullscreen") => {
    const host = context?.ui?.panel
    if (typeof host?.open !== "function") {
      showToast(
        context,
        options.unavailableMessage ?? `This host does not expose the ${options.name} panel.`,
        "warning",
      )
      return
    }
    try {
      const opened = host.open(options.name, { presentation })
      if (opened === false) {
        showToast(
          context,
          options.unavailableMessage ?? `This host does not expose the ${options.name} panel.`,
          "warning",
        )
      }
    } catch (error) {
      options.onError?.(error)
      showToast(context, error instanceof Error ? error.message : String(error), "error")
    }
  }

  return {
    controller: {
      open,
      close: () => last?.close?.(),
      toggleFullscreen: () => last?.toggleFullscreen?.(),
      isActive: () => context?.ui?.panel?.current?.()?.name === options.name,
      input: () => last,
    },
    cleanup,
  }
}
