// Narrow host-contract types for opencode-plugin-kit.
//
// `@opencode-ai/plugin` is beta: its types ARE the spec. Kit consumes only a
// small slice of the host context, so instead of accepting `any` everywhere
// (which silently survives host upgrades and breaks at runtime), this module
// defines the *structural minimum* kit needs and re-exports the exact host
// types it hands back. Consumers get compile-time breakage when the host
// shape drifts, not runtime surprises.
//
// Every interface here is structural: a real host context satisfies it
// as long as the fields exist.

// ---------------------------------------------------------------------------
// Host types kit re-exports (single import point for consumers)
// ---------------------------------------------------------------------------

/** Toast payload — mirrored from the host's TuiToast; host drift here breaks CI. */
export type ToastInput = {
  message: string
  variant?: "success" | "error" | "warning" | "info"
}

/** One selectable row in the picker dialog (only the fields kit populates). */
export type SelectOption<Value = string> = {
  title: string
  value: Value
  description?: string
  disabled?: boolean
}

// ---------------------------------------------------------------------------
// Structural minimum of the host context kit touches
// ---------------------------------------------------------------------------

/** `context.storage.store(key, { initial })` — the older host returns
 * `[value, ref]` (mutating `ref` persists); the newer floating `beta` host
 * types it as `readonly [T, (mutation: (draft: T) => void) => Promise<void>]`.
 * Both shapes satisfy this union; kit code reads `[0]` and mutates it, which
 * both hosts persist. */
export interface KitStorage {
  store<T extends object>(
    key: string,
    opts: { initial: T },
  ): [T, T] | readonly [T, ((mutation: (draft: T) => void) => void | Promise<void>) | T]
}

/** Slot registration. Only `append`/`after` + a synchronous `render` are
 * needed; the host may accept more options. */
export interface KitSlotOptions {
  readonly append?: string
  readonly after?: string
  render: () => unknown
}

export interface KitUI {
  readonly toast: {
    show(input: ToastInput): void
  }
  readonly dialog: {
    alert(input: { title: string; message: string }): Promise<unknown>
    select(input: {
      title: string
      message: string
      current?: string
      options: readonly SelectOption[]
    }): Promise<unknown>
  }
  slot(options: KitSlotOptions): unknown
}

/** Command entry handed to `keymap.layer()`. Structural subset of the
 * host command shape; only what the view picker registers. */
export interface KitCommandEntry {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly group: string
  readonly palette?: boolean
  readonly suggested?: boolean
  readonly slash?: { name: string; aliases?: string[]; arguments?: boolean }
  run: (input?: string) => void
}

export interface KitKeymap {
  layer(register: () => { mode: string; priority: number; commands: KitCommandEntry[] }): void
}

/** `context.data.session.message.list(sessionID)` — messages may arrive as
 * raw objects or `{ info }` envelopes (kit's `unwrap()` handles both). */
export interface KitSessionData {
  readonly session: {
    readonly message: {
      list(sessionID: string): readonly unknown[] | undefined
    }
  }
}

export interface KitClient {
  readonly integration: {
    list(): Promise<unknown>
  }
}

/** The structural minimum context for every kit factory. Deliberately
 * narrower than the host `TuiPluginApi`: kit only reads these surfaces, so
 * consumers can pass their real context directly. */
export interface KitContext {
  readonly storage: KitStorage
  readonly ui: KitUI
  readonly keymap: KitKeymap
  readonly data: KitSessionData
  readonly client: KitClient
  readonly options?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Structural message/model shapes the defensive readers walk
// ---------------------------------------------------------------------------

/** A message in either of the two beta-API shapes: a discriminated
 * `type`-tagged object or `{ info: Message }` envelope. Kit's readers
 * (`unwrap`, `isAssistant`, `providerId`, `modelId`) accept both. */
export interface KitMessageShape {
  readonly type?: string
  readonly role?: string
  readonly providerID?: string
  readonly modelID?: string
  readonly id?: string
  readonly name?: string
  /** Message parts (tool calls, errors ride along as parts in some shapes). */
  readonly parts?: ReadonlyArray<unknown>
  readonly model?: { readonly providerID?: string; readonly modelID?: string; readonly id?: string }
  readonly cost?: number
  readonly time?: { readonly created?: number }
  readonly timeCreated?: string | number
  readonly createdAt?: string
  readonly tokens?: {
    readonly input?: number
    readonly output?: number
    readonly reasoning?: number
    readonly cache?: {
      /** v1 shapes a number; some beta payloads nest it as `{ input }`. */
      readonly read?: number | { readonly input?: number }
      readonly write?: number | { readonly input?: number }
    }
  }
  readonly info?: KitMessageShape
}
