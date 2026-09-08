// Persisted view/filter picker for OpenCode sidebar widgets.
//
// The pattern shared by the usage-quota tracker (`/usage-view`) and the model
// recommender (`/model-view`): a registry of views, a durable selection, a
// slash/palette command registered through a keymap layer (which only works
// from a rendered `app` slot), a dialog picker, and a confirmation toast.
import type { KitContext } from "./host.ts"
import { registerKeymapCommand } from "./commands.ts"
import { persistedCell } from "./cache.ts"
import { createSignal } from "solid-js"

export interface PickerOption {
  readonly id: string
  readonly title: string
  readonly description?: string
}

export interface PickerConfig<T extends PickerOption> {
  /** The view registry — the single extension point. */
  readonly registry: readonly T[]
  /** Durable storage key (plugin-scoped) for the selection. */
  readonly storageKey: string
  /** Slash/palette command wiring. `title` may ignore its argument to show a
   * session-derived effective view (the usage plugin does this). */
  readonly command: {
    readonly id: string
    readonly group: string
    /** Slash name, e.g. "usage-view". */
    readonly name: string
    readonly aliases?: string[]
    readonly title: (current: T) => string
    readonly description: string
  }
  /** Dialog texts for the interactive picker. */
  readonly dialog: { readonly title: string; readonly message: string }
  /** Toast message on switch; defaults to `${prefix}: ${entry.title} view`. */
  readonly toastPrefix?: string
  /** Only these entries are selectable (e.g. provider-key gating). Defaults
   * to everything. Read at pick time, so closures see fresh state. */
  readonly selectable?: (entry: T) => boolean
  /** Message when an explicitly requested entry isn't selectable. */
  readonly unavailableMessage?: (entry: T) => string
}

export interface ViewPicker<T extends PickerOption> {
  /** Currently selected entry (persisted pick; auto-pick logic stays
   * plugin-local and can layer on top). */
  readonly current: () => T
  readonly currentID: () => string
  /** Switch without UI: persist + toast. No-op when already selected. */
  readonly apply: (entry: T) => void
  /** Open the picker, or select directly from an argument (`/x zen`). */
  readonly pick: (arg?: string) => Promise<void>
  /** Register the slash/palette command (call once from setup). */
  readonly registerCommand: () => void
}

export function createViewPicker<T extends PickerOption>(context: KitContext, config: PickerConfig<T>): ViewPicker<T> {
  const registry = config.registry
  const first = registry[0]
  if (!first) throw new Error("createViewPicker: empty registry")

  const [currentID, setCurrentID] = createSignal<string>(first.id)

  type StoredView = { id?: string }
  const cell = persistedCell<StoredView>(context, config.storageKey, { id: first.id })

  // Load the persisted pick, if any.
  try {
    const persisted = cell.read()
    if (persisted?.id && registry.some((e) => e.id === persisted.id)) setCurrentID(persisted.id)
  } catch {
    // In-memory only.
  }

  const persist = (id: string) => {
    cell.persist((s) => {
      s.id = id
    })
  }

  const current = () => registry.find((e) => e.id === currentID()) ?? first

  const apply = (entry: T) => {
    if (entry.id === currentID()) return
    setCurrentID(entry.id)
    persist(entry.id)
    try {
      context.ui.toast.show({
        message: config.toastPrefix ? `${config.toastPrefix}: ${entry.title} view` : entry.title,
        variant: "success",
      })
    } catch {
      // Toast unavailable; reactivity still re-renders.
    }
  }

  const selectable = config.selectable ?? (() => true)

  const pick = async (arg?: string) => {
    const wanted = arg?.trim().toLowerCase()
    if (wanted) {
      const match = registry.find((e) => e.id === wanted || e.title.toLowerCase() === wanted)
      if (match) {
        if (selectable(match)) return apply(match)
        try {
          await context.ui.dialog.alert({
            title: config.dialog.title,
            message: config.unavailableMessage?.(match) ?? `${match.title} is not available right now.`,
          })
        } catch {
          // Dialog unavailable.
        }
        return
      }
      try {
        await context.ui.dialog.alert({
          title: config.dialog.title,
          message: `Unknown view "${arg}". Available: ${
            registry
              .filter(selectable)
              .map((e) => e.id)
              .join(", ") || "none"
          }`,
        })
      } catch {
        // Dialog unavailable.
      }
      return
    }
    try {
      const selected = await context.ui.dialog.select({
        title: config.dialog.title,
        message: config.dialog.message,
        current: currentID(),
        options: registry.filter(selectable).map((e) => ({
          title: e.title,
          value: e.id,
          description: e.description ?? "",
          disabled: false,
        })),
      })
      const match = registry.find((e) => e.id === selected)
      if (match) apply(match)
    } catch {
      // Dialog unavailable.
    }
  }

  // Keymap layers are owned by the calling component, so the command is
  // registered from a rendered `app` slot (see registerKeymapCommand). The
  // factory form keeps the title fresh across palette renders.
  const registerCommand = () =>
    registerKeymapCommand(context, () => ({
      id: config.command.id,
      title: config.command.title(current()),
      description: config.command.description,
      group: config.command.group,
      palette: true,
      slash: {
        name: config.command.name,
        aliases: config.command.aliases,
        arguments: true,
      },
      suggested: true,
      run: (input?: string) => {
        void pick(input)
      },
    }))

  return { current, currentID, apply, pick, registerCommand }
}
