// Defensive message traversal for sidebar widgets.
//
// Both the usage-quota tracker and model recommender walk session messages
// to sum tokens/costs or find the active model. The traversal is always
// defensive (beta API shapes change) and always scoped to assistant
// messages from one provider. Centralize the fold so the try/catch +
// unwrap + filter boilerplate lives in one place.
import { isAssistant, unwrap } from "./providers.ts"
import type { KitContext, KitMessageShape } from "./host.ts"

export interface WalkOptions {
  /** Only visit assistant messages (default true). */
  readonly assistantOnly?: boolean
  /** Only visit messages from this provider (providerID field). */
  readonly provider?: string
  /** Skip messages older than this epoch ms (for windowed walks). */
  readonly since?: number
}

/**
 * Fold over a session's messages defensively. Starts from the most recent
 * message and walks backwards. The reducer receives each message (already
 * unwrapped from `{ info: ... }` envelope). Returning a value replaces the
 * accumulator; returning void keeps it. Never throws — unreadable shapes
 * are skipped.
 *
 * @example
 * // Sum input tokens for the "opencode" provider in the last hour.
 * const totals = walkMessages(context, sessionID, (m, acc) => {
 *   acc.tokens += m?.tokens?.input ?? 0
 *   return acc
 * }, { provider: "opencode", since: Date.now() - 3600_000 }, { tokens: 0 })
 */
export function walkMessages<T>(
  context: KitContext,
  sessionID: string | undefined,
  reducer: (message: any, acc: T) => T | void,
  options: WalkOptions = {},
  initial: T,
): T {
  if (!sessionID) return initial
  const { assistantOnly = true, provider, since } = options

  try {
    const messages = context.data.session.message.list(sessionID) ?? []
    let acc = initial

    for (let i = messages.length - 1; i >= 0; i--) {
      const m = unwrap(messages[i] as KitMessageShape)

      // Skip non-assistant messages when filtering.
      if (assistantOnly && !isAssistant(m)) continue

      // Skip messages from other providers when scoped.
      if (provider) {
        const mProvider = m?.model?.providerID ?? m?.providerID ?? ""
        if (mProvider !== provider) continue
      }

      // Skip messages before the window start.
      if (since) {
        const created = m?.time?.created ?? m?.timeCreated ?? m?.createdAt
        const ts = typeof created === "string" ? Date.parse(created) : typeof created === "number" ? created : NaN
        if (!Number.isFinite(ts) || ts < since) continue
      }

      const result = reducer(m, acc)
      acc = result === undefined ? acc : result
    }

    return acc
  } catch {
    return initial
  }
}

/**
 * Sum token counts and cost for a provider's assistant messages.
 * Convenience wrapper around walkMessages for the common case.
 */
export interface TokenTotals {
  input: number
  output: number
  reasoning: number
  cacheRead: number
  cost: number
}

/** Cache-read tokens: v1 shapes are `cache.read` (number); some beta
 * payloads nest it as `cache.read.input`. Read defensively, typed in
 * `KitMessageShape`. */
export function cacheReadInput(tokens: KitMessageShape["tokens"]): number | { input?: number } | undefined {
  return tokens?.cache?.read
}

export function sumProviderTokens(
  context: KitContext,
  sessionID: string | undefined,
  provider: string,
  since?: number,
): TokenTotals {
  return walkMessages<TokenTotals>(
    context,
    sessionID,
    (m, acc) => {
      const tokens = m?.tokens ?? {}
      acc.input += Number(tokens?.input ?? 0) || 0
      acc.output += Number(tokens?.output ?? 0) || 0
      acc.reasoning += Number(tokens?.reasoning ?? 0) || 0
      const read = cacheReadInput(tokens)
      acc.cacheRead += Number(typeof read === "object" ? (read?.input ?? 0) : (read ?? 0)) || 0
      acc.cost += Number(m?.cost ?? 0) || 0
      return acc
    },
    { provider, since },
    { input: 0, output: 0, reasoning: 0, cacheRead: 0, cost: 0 },
  )
}
