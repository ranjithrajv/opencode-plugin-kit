// Fire-and-forget toast helper.
//
// The host's toast UI is optional at the edges (beta API): every plugin
// hand-rolled the same try/catch fallback around `ui.toast.show`.
import type { KitContext, KitUI, ToastInput } from "./host.ts"

/** Show a toast; silently no-ops when the host has no toast UI or it throws.
 * Takes a minimal structural slice — the full host context's `ui.slot` is
 * over-loaded in newer betas and would not assign to KitContext here. */
export function showToast(
  context: { readonly ui?: { readonly toast?: { readonly show?: (input: ToastInput) => void } } },
  message: string,
  variant: ToastInput["variant"] = "success",
): void {
  try {
    const toast = (context.ui as Partial<KitUI>).toast
    toast?.show?.({ message, variant })
  } catch {
    // Toast unavailable; the caller's inline UI still reflects the change.
  }
}
