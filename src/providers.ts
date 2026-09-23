// Shared provider vocabulary for OpenCode sidebar widgets.
// Provider IDs are the OpenCode workspace provider ids ("opencode" = Zen,
// "opencode-go" = Go).
import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { createRequire } from "node:module"
import { createSignal } from "solid-js"
import { connectedProviderIds } from "./schemas.ts"
import type { KitContext, KitMessageShape } from "./host.ts"

export const ZEN_PROVIDER = "opencode"
export const GO_PROVIDER = "opencode-go"
export const DEFAULT_PROVIDERS = [ZEN_PROVIDER, GO_PROVIDER]

/** Short human label for the provider column, e.g. "zen" / "go". */
export function providerLabel(pid: string): string {
  if (pid === ZEN_PROVIDER) return "zen"
  if (pid === GO_PROVIDER) return "go"
  if (pid === "google") return "google"
  if (pid === "zai-coding-plan") return "zai"
  if (pid === "huggingface") return "hf"
  return pid
}

/** Full display title for a provider — picker dialogs, view headers. */
export function providerTitle(pid: string): string {
  if (pid === ZEN_PROVIDER) return "Zen"
  if (pid === GO_PROVIDER) return "Go"
  if (pid === "google") return "Google"
  if (pid === "zai-coding-plan") return "Z.AI"
  if (pid === "huggingface") return "Hugging Face"
  return pid
}

/** Unwrap a beta-API message entry: `{ info: {...} }` -> the inner object. */
export function unwrap(entry: KitMessageShape): KitMessageShape {
  return entry?.info ?? entry
}

/**
 * True for assistant messages. Beta schema messages discriminate by `type`
 * tags ("assistant", "user", ...), not a `role` field — tolerate both so the
 * filter keeps working if a client exposes `role` instead.
 */
export function isAssistant(m: KitMessageShape): boolean {
  return (m?.type ?? m?.role) === "assistant"
}

/** Normalize `{ data: [...] }` API responses (or a bare array) to an array. */
export function asArray<T = any>(out: unknown): T[] {
  return Array.isArray(out) ? (out as T[]) : ((out as any)?.data ?? [])
}

/** Model id from either a model-list object or a message/message-part shape. */
export function modelId(m: KitMessageShape): string {
  return m?.model?.modelID ?? m?.modelID ?? m?.model?.id ?? m?.id ?? ""
}

/** Provider id from either a model-list object or a message/message-part shape. */
export function providerId(m: KitMessageShape): string {
  return m?.model?.providerID ?? m?.providerID ?? ""
}

/** Display name, falling back to the model id when the API omits `name`. */
export function modelName(m: KitMessageShape): string {
  return m?.name ?? modelId(m)
}

// ---------------------------------------------------------------------------
// Dynamic provider discovery
// ---------------------------------------------------------------------------

const AUTH_PATH = () => join(homedir(), ".local/share/opencode/auth.json")
const DB_PATH = () => join(homedir(), ".local/share/opencode/opencode.db")

/** Run a query with either SQLite driver's API and return rows. */
function queryRows(db: any, sql: string): any[] {
  try { return db.query(sql).all() } catch {}
  try { return db.prepare(sql).all() } catch {}
  return []
}

/** Open OpenCode 2's SQLite store read-only, resolving the driver across
 * Bun (`bun:sqlite`) and Node 22+ (`node:sqlite`). Returns null when the
 * store is absent or no driver is available. */
function openCredentialDb(): any | null {
  if (!existsSync(DB_PATH())) return null
  const attempts: Array<() => any> = [
    () => (import.meta as any).require?.("bun:sqlite"),
    () => (globalThis as any).require?.("bun:sqlite"),
    () => createRequire(import.meta.url)("bun:sqlite"),
    () => (Function("return require")() as any)("bun:sqlite"),
  ]
  for (const attempt of attempts) {
    try {
      const { Database } = attempt()
      if (Database) return new Database(DB_PATH(), { readonly: true })
    } catch {}
  }
  try {
    const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite")
    if (DatabaseSync) return new DatabaseSync(DB_PATH(), { readOnly: true })
  } catch {}
  return null
}

let _dbCache: { at: number; keys: Record<string, string> } | null = null

/** API keys from OpenCode 2's SQLite `credential` table (integration_id →
 * key). Cached briefly because `readAuth` runs on every render. */
function readAuthDb(): Record<string, string> {
  const now = Date.now()
  if (_dbCache && now - _dbCache.at < 30_000) return _dbCache.keys
  const keys: Record<string, string> = {}
  try {
    const db = openCredentialDb()
    if (db) {
      for (const row of queryRows(db, "SELECT integration_id, value FROM credential")) {
        const id = String(row?.integration_id ?? "").trim()
        try {
          const key = JSON.parse(String(row?.value ?? ""))?.key
          if (id && typeof key === "string" && key.trim()) keys[id] = key.trim()
        } catch {}
      }
      try { db.close?.() } catch {}
    }
  } catch {}
  _dbCache = { at: now, keys }
  return keys
}

/** Single defensive read of the auth sources, keyed by provider id.
 * OpenCode 2 keeps credentials in its SQLite store; `auth.json` is the
 * legacy V1 store. Both are read (SQLite wins on conflict) so consumers see
 * the same keys regardless of OpenCode version. */
export function readAuth(): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    const auth = JSON.parse(readFileSync(AUTH_PATH(), "utf8"))
    for (const [id, cfg] of Object.entries(auth)) {
      const key = (cfg as any)?.key
      if (typeof key === "string" && key.trim()) out[id] = key.trim()
    }
  } catch {}
  for (const [id, key] of Object.entries(readAuthDb())) out[id] = key
  return out
}

/** The API key for one provider, or "" when absent. */
export function authKey(providerID: string): string {
  return readAuth()[providerID] ?? ""
}

/** Whether the provider has a stored key (fallback when the integration
 * list is unavailable, e.g. before the first client fetch). */
export function hasKey(providerID: string): boolean {
  return authKey(providerID) !== ""
}

/** Workspace keys in a preferred order, skipping missing ones.
 * `fallbacks` are returned (still filtered) when none of `preferred` exist —
 * used by the usage endpoint, which accepts any workspace key. */
export function authKeys(preferred: string[], ...fallbacks: string[]): string[] {
  const auth = readAuth()
  const pick = (ids: string[]) => ids.map((id) => auth[id] ?? "").filter(Boolean)
  const keys = pick(preferred)
  return keys.length > 0 ? keys : pick(fallbacks)
}

const FALLBACK_PROVIDERS = [ZEN_PROVIDER, GO_PROVIDER] as const

let _providers: string[] | null = null

/**
 * All providers that have credentials in this workspace — read from
 * `~/.local/share/opencode/auth.json` (API keys) plus `HF_TOKEN` env
 * (HuggingFace). Result is memoized; at most one file read per process.
 * Falls back to Zen + Go if auth.json is unreadable. This is the sync
 * core of provider discovery; reactive widgets use createConnectedProviders.
 */
export function availableProviders(): string[] {
  if (_providers) return _providers

  const ids = Object.keys(readAuth())

  if (ids.length === 0) ids.push(...FALLBACK_PROVIDERS)
  if (process.env.HF_TOKEN && !ids.includes("huggingface")) {
    ids.push("huggingface")
  }

  _providers = ids
  return _providers
}

// ---------------------------------------------------------------------------
// Reactive connected-provider tracking
// ---------------------------------------------------------------------------

export interface ConnectedProvidersOptions {
  /** Polling interval in ms. Defaults to 30_000. Set to 0 to disable. */
  readonly pollMs?: number
}

export interface ConnectedProviders {
  /** Reactive set of connected provider ids. */
  readonly ids: () => Set<string>
  /** Whether a specific provider is connected. */
  readonly has: (providerID: string) => boolean
  /** Force an immediate refresh. */
  readonly refresh: () => Promise<void>
  /** Stop polling (call from cleanup). */
  readonly stop: () => void
}

/**
 * Track which providers are connected, reactively — for widgets that gate
 * views on "is this provider connected?". Polls the integration list (the
 * source /connect writes) and unions in env-only providers (HF_TOKEN).
 * When the client is unavailable, falls back to the sync auth.json-based
 * `availableProviders()` discovery.
 */
export function createConnectedProviders(
  context: KitContext,
  options: ConnectedProvidersOptions = {},
): ConnectedProviders {
  const [ids, setIds] = createSignal<Set<string>>(new Set())

  async function refresh(): Promise<void> {
    try {
      const next = connectedProviderIds(await context.client.integration.list())
      if (process.env.HF_TOKEN) next.add("huggingface")
      setIds(next)
    } catch {
      setIds(new Set(availableProviders()))
    }
  }

  // Initial refresh.
  void refresh()

  const pollMs = options.pollMs ?? 30_000
  let timer: ReturnType<typeof setInterval> | null = null
  if (pollMs > 0) {
    timer = setInterval(() => void refresh(), pollMs)
  }

  return {
    ids,
    has: (providerID: string) => ids().has(providerID),
    refresh,
    stop: () => {
      if (timer !== null) {
        clearInterval(timer)
        timer = null
      }
    },
  }
}
