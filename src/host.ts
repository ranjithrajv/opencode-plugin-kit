// Narrow host-contract types for opencode-plugin-kit.
//
// `@opencode/plugin` (v2) types ARE the spec. Kit consumes only a
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

/** Toast payload — structural subset of the host's v2 `ToastOptions`; drift breaks CI. */
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

/** `context.storage.store(key, { initial })` — v2 types this as
 * `readonly [Store<T>, (mutation: (draft: T) => void) => Promise<void>]`;
 * the older host returned `[T, T]` (mutating the second entry persisted).
 * Both shapes satisfy this union; kit reads `[0]` and mutates it, which
 * both hosts persist. */
export interface KitStorage {
  store<T extends object>(
    key: string,
    opts: { initial: T },
  ): [T, T] | readonly [T, ((mutation: (draft: T) => void) => void | Promise<void>) | T]
  /** Newer hosts expose a reactive memory store alongside (or instead of)
   * `store`. Both back `createPersistedState`. */
  memory?<T extends object>(
    key: string,
    opts: { initial: T },
  ): [T, (mutation: (draft: T) => void) => void | Promise<void>]
}

/** Slot registration. The host may accept more anchors than kit uses. */
export interface KitSlotOptions {
  readonly append?: string
  readonly after?: string
  readonly before?: string
  readonly replace?: string
  render: (input?: any) => unknown
}

/** Full-screen panel surface (optional on older hosts). */
export interface KitPanel {
  open(name: string, options?: { presentation?: "panel" | "fullscreen" }): boolean | void
  current?(): { name?: string } | undefined
  close?(): void
}

/** Plugin page routing — register a page and navigate to it. */
export interface KitRouter {
  register(page: { name: string; render: (input: { data?: Record<string, unknown> }) => unknown }): () => void
  navigate(destination: { type: "plugin"; id: string; name: string; data?: Record<string, unknown> }): void
  current(): { type: string; id?: string; name?: string } | undefined
}

/** Session tab operations. */
export interface KitTabs {
  enabled(): boolean
  list(): ReadonlyArray<{ sessionID: string; title?: string; active: boolean; busy?: boolean }>
  open(sessionID: string): boolean
  focus(sessionID: string): boolean
  move(sessionID: string, index: number): boolean
  close(sessionID?: string): boolean
}

/** Attention notification with optional sound and system notification. */
export interface KitAttention {
  notify(options: {
    title?: string
    message: string
    notification?: boolean
    sound?: boolean
  }): Promise<{ ok: boolean }>
}

export interface KitUI {
  readonly toast: {
    show(input: ToastInput): void
  }
  readonly dialog: {
    alert(input: { title: string; message: string }): Promise<unknown>
    select(input: {
      title: string
      placeholder?: string
      current?: string
      options: readonly SelectOption[]
    }): Promise<unknown>
  }
  slot(options: KitSlotOptions): unknown
  readonly panel?: KitPanel
  readonly router?: KitRouter
  readonly tabs?: KitTabs
}

/** Command entry handed to `keymap.layer()`. Structural subset of the
 * host command shape; only what the view picker registers. */
export interface KitCommandEntry {
  readonly id: string
  readonly title: string
  /** Optional: panel-scoped key commands often omit palette metadata. */
  readonly description?: string
  readonly group?: string
  readonly palette?: true
  readonly suggested?: boolean
  /** Key binding for panel-scoped layers. */
  readonly bind?: string
  /** Command-level enablement (e.g. "only while my panel is active"). */
  readonly enabled?: () => boolean
  readonly slash?: { name: string; aliases?: string[]; arguments?: true }
  run: (input?: string) => void
}

export interface KitKeymap {
  layer(
    register: () => {
      /** Defaults to the host's base mode when omitted. */
      mode?: string
      priority: number
      /** Layer-level enablement (newer hosts). */
      enabled?: () => boolean
      commands: KitCommandEntry[]
    },
  ): void
}

/** `context.data.session.message.list(sessionID)` — messages may arrive as
 * raw objects or `{ info }` envelopes (kit's `unwrap()` handles both). */
export interface KitSessionData {
  readonly session: {
    readonly message: {
      list(sessionID: string): readonly unknown[] | undefined
    }
    readonly list?: () => readonly unknown[]
  }
  /** Subscribe to a host data event; returns an unsubscribe fn when supported. */
  readonly on?: (type: string, handler: () => void) => (() => void) | undefined
}

export interface KitClient {
  readonly integration: {
    list(): Promise<unknown>
  }
}

/** The structural minimum context for every kit factory. Deliberately
 * narrower than the host `Plugin.Context`: kit only reads these surfaces, so
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

/** A model-list entry (host `ModelInfo`) — what the model accessors accept.
 * Deliberately omits `cost`, which is a number on messages but an array on
 * model entries, so the same accessors serve both. */
export interface KitModelShape {
  readonly id?: string
  readonly modelID?: string
  readonly providerID?: string
  readonly name?: string
  readonly model?: { readonly providerID?: string; readonly modelID?: string; readonly id?: string }
}

/** A message in either of the two v2 shapes: a discriminated `type`-tagged
 * object or `{ info: Message }` envelope. Kit's readers (`unwrap`,
 * `isAssistant`, `providerId`, `modelId`) accept both. */
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
