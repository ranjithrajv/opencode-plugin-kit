// Slash/palette command registration: the shared plumbing under
// createViewPicker and createToggle.
//
// Keymap layers are owned by the calling component, so a command must be
// registered from a rendered `app` slot — a layer registered directly in
// setup() never becomes active.
import { createSignal } from "solid-js"
import type { KitCommandEntry, KitContext } from "./host.ts"
import { showToast } from "./toast.ts"

/**
 * Register one slash/palette command through a keymap layer. `command` may be
 * a factory — it re-evaluates on every palette render, keeping titles fresh
 * after the underlying state changes.
 */
export function registerKeymapCommand(context: KitContext, command: KitCommandEntry | (() => KitCommandEntry)): void {
  try {
    context.ui.slot({
      append: "app",
      render: () => {
        try {
          const entry = typeof command === "function" ? command() : command
          context.keymap.layer(() => ({ mode: "global", priority: 10, commands: [entry] }))
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

export interface ToggleCommandConfig {
  readonly id: string
  readonly group: string
  /** Slash name, e.g. "plugins-builtins". */
  readonly name: string
  readonly aliases?: string[]
  readonly description: string
  /** Palette title; re-evaluated on every palette render. */
  readonly title: (value: boolean) => string
}

export interface ToggleConfig {
  /** Durable storage key (plugin-scoped) for the boolean. */
  readonly storageKey: string
  readonly initial: boolean
  readonly command: ToggleCommandConfig
  /** Toast message on toggle; omit for a silent toggle. */
  readonly toast?: (value: boolean) => string
}

export interface Toggle {
  readonly value: () => boolean
  readonly toggle: () => void
  readonly registerCommand: () => void
}

/**
 * A persisted boolean with a slash/palette command to flip it — the
 * single-toggle counterpart to createViewPicker. The persisted shape is
 * `{ value: boolean }`; anything unreadable (including a foreign legacy
 * shape under the same key) falls back to `initial`.
 */
export function createToggle(context: KitContext, config: ToggleConfig): Toggle {
  const [value, setValue] = createSignal(config.initial)

  type StoredToggle = { value?: boolean }
  const store = (initial: StoredToggle): [StoredToggle, StoredToggle] | undefined => {
    try {
      return context.storage.store(config.storageKey, { initial }) as [StoredToggle, StoredToggle]
    } catch {
      return undefined
    }
  }

  // Restore the persisted pick, if readable.
  try {
    const persisted = store({ value: config.initial })?.[0]
    if (typeof persisted?.value === "boolean") setValue(persisted.value)
  } catch {
    // In-memory only.
  }

  const toggle = () => {
    const next = !value()
    setValue(next)
    const s = store({ value: config.initial })?.[0]
    if (s) s.value = next
    const message = config.toast?.(next)
    if (message) showToast(context, message)
  }

  const registerCommand = () =>
    registerKeymapCommand(context, () => ({
      id: config.command.id,
      title: config.command.title(value()),
      description: config.command.description,
      group: config.command.group,
      palette: true,
      slash: {
        name: config.command.name,
        aliases: config.command.aliases,
      },
      suggested: true,
      run: () => toggle(),
    }))

  return { value, toggle, registerCommand }
}
