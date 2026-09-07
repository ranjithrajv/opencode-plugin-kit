// Shared provider vocabulary for OpenCode sidebar widgets.
// Provider IDs are the OpenCode workspace provider ids ("opencode" = Zen,
// "opencode-go" = Go).
import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

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
export function unwrap(entry: any): any {
  return entry?.info ?? entry
}

/** Normalize `{ data: [...] }` API responses (or a bare array) to an array. */
export function asArray<T = any>(out: any): T[] {
  return Array.isArray(out) ? (out as T[]) : ((out as any)?.data ?? [])
}

/** Model id from either a model-list object or a message/message-part shape. */
export function modelId(m: any): string {
  return m?.model?.modelID ?? m?.modelID ?? m?.model?.id ?? m?.id ?? ""
}

/** Provider id from either a model-list object or a message/message-part shape. */
export function providerId(m: any): string {
  return m?.model?.providerID ?? m?.providerID ?? ""
}

/** Display name, falling back to the model id when the API omits `name`. */
export function modelName(m: any): string {
  return m?.name ?? modelId(m)
}

// ---------------------------------------------------------------------------
// Dynamic provider discovery
// ---------------------------------------------------------------------------

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

  const ids: string[] = []
  try {
    const auth = JSON.parse(readFileSync(join(homedir(), ".local/share/opencode/auth.json"), "utf8"))
    for (const [id, cfg] of Object.entries(auth)) {
      if ((cfg as any)?.key && typeof (cfg as any).key === "string") {
        ids.push(id)
      }
    }
  } catch {
    // Unreadable — fall back to the two known defaults below.
  }

  if (ids.length === 0) ids.push(...FALLBACK_PROVIDERS)
  if (process.env.HF_TOKEN && !ids.includes("huggingface")) {
    ids.push("huggingface")
  }

  _providers = ids
  return _providers
}
