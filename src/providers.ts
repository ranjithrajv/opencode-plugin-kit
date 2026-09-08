// Shared provider vocabulary for OpenCode sidebar widgets.
// Provider IDs are the OpenCode workspace provider ids ("opencode" = Zen,
// "opencode-go" = Go).
import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import type { KitMessageShape } from "./host.ts"

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

/** Single defensive read of auth.json, keyed by provider id.
 * Every consumer shares this parse so the path and shape handling can't drift. */
export function readAuth(): Record<string, string> {
  try {
    const auth = JSON.parse(readFileSync(AUTH_PATH(), "utf8"))
    const out: Record<string, string> = {}
    for (const [id, cfg] of Object.entries(auth)) {
      const key = (cfg as any)?.key
      if (typeof key === "string" && key.trim()) out[id] = key.trim()
    }
    return out
  } catch {
    return {}
  }
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
 * Falls back to Zen + Go if auth.json is unreadable.
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
