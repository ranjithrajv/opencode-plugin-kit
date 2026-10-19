// Incremental session message index.
//
// Summing usage means reading every session's message history, so the naive
// shape — re-walk everything on every render — is O(sessions × messages)
// forever. This builds a per-context index once per TTL: each message is parsed
// at most once into a compact entry, unchanged sessions are skipped by a cheap
// fingerprint, and entries outside the retained window are swept so memory
// tracks the window rather than the whole history.
//
// The index is keyed by context object (a WeakMap), so two plugins — or two
// contexts in tests — never share state.
import type { KitContext } from "./host.ts"
import { isAssistant, unwrap } from "./providers.ts"

export interface MessageIndexOptions<T extends { ts: number }> {
  /** Skip messages older than this (epoch ms). */
  readonly since: (now: number) => number
  /** Build an entry from an unwrapped message; return undefined to skip it. */
  readonly parse: (message: any, ts: number) => T | undefined
  /** Which messages to consider. Defaults to assistant messages. */
  readonly include?: (message: any) => boolean
  /** Keep an already-parsed entry during a scan. Defaults to `entry.ts >= since(now)`. */
  readonly retain?: (entry: T, now: number) => boolean
  /** Cheap change detector for a session's message list. */
  readonly fingerprint?: (messages: readonly unknown[]) => string
  /** How long a scan is reused. Defaults to 30s. */
  readonly ttlMs?: number
}

export interface MessageIndex<T extends { ts: number }> {
  /** Re-scan (respecting the TTL) and return every retained entry. */
  scan(context: KitContext): T[]
  /** Retained session and entry counts for the last scan of this context. */
  size(context: unknown): { sessions: number; entries: number }
  /** Drop every cached scan. */
  reset(): void
}

interface Scan<T> {
  fingerprint: string
  entries: T[]
}
interface Store<T> {
  at: number
  scans: Map<string, Scan<T>>
}

function timestampOf(message: any): number {
  const created = message?.time?.created ?? message?.timeCreated ?? message?.createdAt
  if (typeof created === "number") return created
  if (typeof created === "string") {
    const parsed = Date.parse(created)
    return Number.isFinite(parsed) ? parsed : Number.NaN
  }
  return Number.NaN
}

/** Identity of a session's last message: length + id + created + tokens. */
export function messageFingerprint(messages: readonly unknown[]): string {
  const last = messages.length ? unwrap(messages[messages.length - 1] as any) : undefined
  if (!last) return "0"
  const created = last?.time?.created ?? last?.timeCreated ?? last?.createdAt ?? ""
  return `${messages.length}:${last?.id ?? ""}:${created}:${last?.tokens ? JSON.stringify(last.tokens) : ""}`
}

export function createMessageIndex<T extends { ts: number }>(options: MessageIndexOptions<T>): MessageIndex<T> {
  let stores = new WeakMap<object, Store<T>>()
  const ttl = options.ttlMs ?? 30_000
  const include = options.include ?? isAssistant
  const fingerprint = options.fingerprint ?? messageFingerprint
  const retain = options.retain ?? ((entry: T, now: number) => entry.ts >= options.since(now))

  function scanSession(context: KitContext, sid: string, store: Store<T>, since: number): void {
    const list = (context as any)?.data?.session?.message?.list?.(sid) as readonly any[] | undefined
    if (!list) {
      store.scans.delete(sid)
      return
    }
    const print = fingerprint(list)
    const prev = store.scans.get(sid)
    if (prev && prev.fingerprint === print) return

    const entries: T[] = []
    for (const raw of list) {
      const message = unwrap(raw)
      if (!include(message)) continue
      const ts = timestampOf(message)
      if (!Number.isFinite(ts)) continue
      if (ts < since) continue
      const entry = options.parse(message, ts)
      if (entry) entries.push(entry)
    }
    store.scans.set(sid, { fingerprint: print, entries })
  }

  function flatten(store: Store<T>): T[] {
    const out: T[] = []
    for (const scan of store.scans.values()) out.push(...scan.entries)
    return out
  }

  return {
    scan(context) {
      const key = context as unknown as object
      const store = stores.get(key) ?? { at: 0, scans: new Map<string, Scan<T>>() }
      const now = Date.now()
      if (now - store.at < ttl) return flatten(store)

      let listed: readonly any[] = []
      try {
        listed = (context as any)?.data?.session?.list?.() ?? []
      } catch {
        // Keep the previous scan rather than blanking the widget.
        store.at = now
        stores.set(key, store)
        return flatten(store)
      }

      const since = options.since(now)
      const seen = new Set<string>()
      for (const session of listed) {
        const sid = String(session?.id ?? session?.info?.id ?? "")
        if (!sid) continue
        seen.add(sid)
        try {
          scanSession(context, sid, store, since)
        } catch {
          // This session's history is unreadable — keep what we had for it.
        }
      }
      // Drop sessions that no longer exist so deleted history stops counting.
      for (const sid of [...store.scans.keys()]) if (!seen.has(sid)) store.scans.delete(sid)
      // Sweep entries the widget can no longer show.
      for (const scan of store.scans.values()) {
        const kept = scan.entries.filter((entry) => retain(entry, now))
        if (kept.length !== scan.entries.length) scan.entries = kept
      }

      store.at = now
      stores.set(key, store)
      return flatten(store)
    },
    size(context) {
      const store = stores.get(context as unknown as object)
      let entries = 0
      for (const scan of store?.scans.values() ?? []) entries += scan.entries.length
      return { sessions: store?.scans.size ?? 0, entries }
    },
    reset() {
      stores = new WeakMap<object, Store<T>>()
    },
  }
}
