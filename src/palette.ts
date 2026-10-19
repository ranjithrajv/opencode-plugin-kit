// Command palette registration helpers.
//
// The palette is the primary discovery surface for plugin commands. Multiple
// plugins each register palette commands with the same wiring: a keymap layer
// owned by a rendered `app` slot, command entries with palette metadata,
// dynamic titles that re-evaluate on every palette render, and error handling
// for hosts without keymap support. This module centralizes that pattern.
import type { KitCommandEntry, KitContext } from "./host.ts"
import { registerKeymapCommand } from "./commands.ts"

/** A palette command definition — the plugin-specific fields. */
export interface PaletteCommandConfig {
  readonly id: string
  readonly title: string
  readonly description?: string
  readonly group?: string
  /** Slash name for this command (if it should also work as /command). */
  readonly slash?: { name: string; aliases?: string[]; arguments?: true }
  /** Whether this command appears in the palette. Defaults to true. */
  readonly palette?: true
  /** Whether this command is promoted in discovery UI. */
  readonly suggested?: boolean
  /** Key binding for this command. */
  readonly bind?: string
  /** Whether this command is currently enabled. */
  readonly enabled?: () => boolean
  /** Execute the command. */
  readonly run: (input?: string) => void
}

/** A group of related palette commands registered together. */
export interface PaletteGroup {
  readonly group: string
  readonly commands: readonly PaletteCommandConfig[]
}

/**
 * Build a complete palette command entry from a config. The title is a
 * factory so it re-evaluates on every palette render, keeping titles fresh
 * after underlying state changes.
 */
export function paletteCommand(config: PaletteCommandConfig): KitCommandEntry {
  return {
    id: config.id,
    title: config.title,
    description: config.description,
    group: config.group,
    palette: config.palette ?? true,
    suggested: config.suggested,
    bind: config.bind,
    enabled: config.enabled,
    slash: config.slash,
    run: config.run,
  }
}

/**
 * Register a single palette command. The command is registered through a
 * rendered `app` slot's keymap layer, which is the only reliable way to
 * activate palette commands.
 */
export function registerPaletteCommand(context: KitContext, config: PaletteCommandConfig): void {
  registerKeymapCommand(context, () => paletteCommand(config))
}

/**
 * Register a group of related palette commands under a single group name.
 * All commands share the same keymap layer, registered from one `app` slot.
 */
export function registerPaletteGroup(context: KitContext, group: PaletteGroup): void {
  try {
    context.ui.slot({
      append: "app",
      render: () => {
        try {
          context.keymap.layer(() => ({
            mode: "global",
            priority: 10,
            commands: group.commands.map((cmd) => paletteCommand({ ...cmd, group: cmd.group ?? group.group })),
          }))
        } catch (err) {
          console.warn("opencode-plugin-kit: keymap.layer unavailable", err)
        }
        return null
      },
    })
  } catch (err) {
    console.warn("opencode-plugin-kit: ui.slot unavailable", err)
  }
}

/**
 * Create a palette command with a dynamic title. The title factory is called
 * on every palette render, so the title always reflects current state.
 */
export function dynamicPaletteCommand(
  config: PaletteCommandConfig & { title: (state?: unknown) => string },
  getState?: () => unknown,
): KitCommandEntry {
  return {
    id: config.id,
    title: config.title(getState?.()),
    description: config.description,
    group: config.group,
    palette: config.palette ?? true,
    suggested: config.suggested,
    bind: config.bind,
    enabled: config.enabled,
    slash: config.slash,
    run: config.run,
  }
}
