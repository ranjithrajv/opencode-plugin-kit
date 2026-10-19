// Semantic colour tones shared by every plugin surface.
//
// Plugins branch on intent ("this row is an error") and let the host theme pick
// the actual colour. Keeping that mapping in one place stops every widget from
// inventing its own fallback palette.

/** Semantic slot a row, label or badge maps onto. */
export type Tone = "base" | "muted" | "error" | "warning" | "success" | "info"

/**
 * Structural slice of the host theme kit reads. Deliberately loose (`unknown`)
 * so any host theme — including the RGBA-typed one — assigns without a cast,
 * and so older themes that only expose `text`/`status` still work.
 */
export interface ToneTheme {
  readonly text?: {
    readonly base?: unknown
    readonly default?: unknown
    readonly muted?: unknown
    readonly subdued?: unknown
    readonly danger?: unknown
    readonly warning?: unknown
    readonly info?: unknown
    readonly feedback?: {
      readonly error?: { readonly base?: unknown }
      readonly warning?: { readonly base?: unknown }
      readonly success?: { readonly base?: unknown }
      readonly info?: { readonly base?: unknown }
    }
  }
  readonly status?: {
    readonly error?: unknown
    readonly warning?: unknown
    readonly success?: unknown
    readonly info?: unknown
  }
}

/** Last-resort palette for hosts that expose no theme at all. */
const FALLBACK: Record<Tone, string> = {
  base: "#ffffff",
  muted: "#888888",
  error: "#ff5555",
  warning: "#f1fa8c",
  success: "#50fa7b",
  info: "#8be9fd",
}

/**
 * Resolve a semantic tone to a host theme colour. Prefers the host's
 * `text.feedback` block, then `status`, then the plain text aliases, and
 * finally a neutral fallback so a missing theme never blanks the UI.
 */
export function toneColor(theme: ToneTheme | undefined, tone: Tone = "base"): unknown {
  const text = theme?.text ?? {}
  const feedback = text.feedback ?? {}
  const status = theme?.status ?? {}
  switch (tone) {
    case "error":
      return feedback.error?.base ?? status.error ?? text.danger ?? FALLBACK.error
    case "warning":
      return feedback.warning?.base ?? status.warning ?? text.warning ?? FALLBACK.warning
    case "success":
      return feedback.success?.base ?? status.success ?? FALLBACK.success
    case "info":
      return feedback.info?.base ?? status.info ?? text.info ?? FALLBACK.info
    case "muted":
      return text.muted ?? text.subdued ?? FALLBACK.muted
    default:
      return text.base ?? text.default ?? FALLBACK.base
  }
}
