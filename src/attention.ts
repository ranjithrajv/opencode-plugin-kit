// Attention notification helpers.
//
// Plugins that need to interrupt the user (task completion, errors, important
// updates) repeat the same wiring: request attention with a notification
// and/or sound, handle hosts without attention support, and fall back to a
// toast when attention is unavailable. This module owns that pattern.
import type { KitContext } from "./host.ts"
import { showToast } from "./toast.ts"

/** Attention notification options. */
export interface AttentionOptions {
  /** Notification title. */
  readonly title?: string
  /** Notification message. Required. */
  readonly message: string
  /** Whether to show a system notification. Defaults to true. */
  readonly notification?: boolean
  /** Whether to play a sound. Defaults to false. */
  readonly sound?: boolean
  /** Fallback toast message when attention is unavailable. */
  readonly fallbackToast?: boolean
}

export interface AttentionResult {
  /** Whether the attention request succeeded. */
  readonly ok: boolean
  /** Whether a system notification was shown. */
  readonly notified: boolean
  /** Whether a sound was played. */
  readonly sounded: boolean
  /** The fallback toast was shown. */
  readonly fellBack: boolean
}

/**
 * Request attention for an important event. Falls back to a toast when the
 * host has no attention support. Never throws.
 */
export async function requestAttention(context: KitContext, options: AttentionOptions): Promise<AttentionResult> {
  const attention = (context as any)?.attention

  if (!attention || typeof attention.notify !== "function") {
    // Fall back to toast.
    let fellBack = false
    if (options.fallbackToast !== false) {
      showToast(context, options.message, "info")
      fellBack = true
    }
    return { ok: fellBack, notified: false, sounded: false, fellBack }
  }

  try {
    const result = await attention.notify({
      title: options.title,
      message: options.message,
      notification: options.notification ?? true,
      sound: options.sound ?? false,
    })

    return {
      ok: result?.ok ?? true,
      notified: result?.notification ?? false,
      sounded: result?.sound ?? false,
      fellBack: false,
    }
  } catch {
    // Attention failed; fall back to toast.
    let fellBack = false
    if (options.fallbackToast !== false) {
      showToast(context, options.message, "info")
      fellBack = true
    }
    return { ok: fellBack, notified: false, sounded: false, fellBack }
  }
}

/**
 * Request attention for a completed task. Uses a notification with sound.
 */
export function notifyTaskComplete(context: KitContext, message: string, title?: string): Promise<AttentionResult> {
  return requestAttention(context, {
    title: title ?? "Task complete",
    message,
    notification: true,
    sound: true,
  })
}

/**
 * Request attention for an error. Uses a notification without sound.
 */
export function notifyError(context: KitContext, message: string, title?: string): Promise<AttentionResult> {
  return requestAttention(context, {
    title: title ?? "Error",
    message,
    notification: true,
    sound: false,
  })
}
