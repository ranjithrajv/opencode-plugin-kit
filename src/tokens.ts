// Token and cost normalization for message shapes.
//
// The beta API has shipped cache counts both as `cache.read: number` and as
// `cache.read: { input }`, and cost both as a number and as an object. Every
// cost/usage widget needs the same defensive read, so it lives here.

export interface TokenBreakdown {
  input: number
  output: number
  reasoning: number
  cacheRead: number
  cacheWrite: number
  total: number
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

/** Cache counts are either a plain number or a nested `{ input }` payload. */
function cacheCount(value: unknown): number {
  if (typeof value === "number") return num(value)
  if (value && typeof value === "object") return num((value as { input?: unknown }).input)
  return 0
}

/**
 * Normalize a message's `tokens` block. Missing or malformed fields read as 0;
 * `total` includes cache reads and writes, matching how OpenCode reports usage.
 */
export function tokenBreakdown(info: unknown): TokenBreakdown {
  const tokens = ((info as { tokens?: Record<string, unknown> } | undefined)?.tokens ?? {}) as Record<string, unknown>
  const cache = (tokens.cache ?? {}) as Record<string, unknown>
  const input = num(tokens.input)
  const output = num(tokens.output)
  const reasoning = num(tokens.reasoning)
  const cacheRead = cacheCount(cache.read)
  const cacheWrite = cacheCount(cache.write)
  return {
    input,
    output,
    reasoning,
    cacheRead,
    cacheWrite,
    total: input + output + reasoning + cacheRead + cacheWrite,
  }
}

/** Recorded cost: a number, or an object with `total`/`cost`. */
export function messageCost(info: unknown): number {
  const cost = (info as { cost?: unknown } | undefined)?.cost
  if (typeof cost === "number") return num(cost)
  if (cost && typeof cost === "object") {
    const record = cost as { total?: unknown; cost?: unknown }
    return num(record.total ?? record.cost)
  }
  return 0
}

/** Rough token estimate for static text (~4 chars/token), never below 1. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(String(text ?? "").length / 4))
}
