// Sidebar layout math.
//
// Sidebar slots publish a session id but no width, so widgets measure their
// laid-out box instead. These pure helpers turn that measurement into a usable
// row budget and column widths, keeping the magic constants in one place.

export interface LayoutOptions {
  /** Width assumed before the first layout pass. */
  readonly fallbackWidth?: number
  /** Per-side padding the host reserves around slot content. */
  readonly gutter?: number
  /** Narrowest row that still carries a label and a value. */
  readonly minRow?: number
  /** Widest the id/model column ever grows. */
  readonly maxColumn?: number
  /** Budget below which the compact layout is used. */
  readonly compactBelow?: number
}

const FALLBACK_WIDTH = 40
const GUTTER = 2
const MIN_ROW = 12
const MAX_COLUMN = 30
const COMPACT_BELOW = 20

/** Usable content width for a measured sidebar width. `available` is 0 until
 * the first layout pass lands, in which case the fallback is used. */
export function budgetFor(available: number, options: LayoutOptions = {}): number {
  const fallback = options.fallbackWidth ?? FALLBACK_WIDTH
  const gutter = options.gutter ?? GUTTER
  const minRow = options.minRow ?? MIN_ROW
  return Math.max(minRow, (available > 0 ? available : fallback) - gutter)
}

/** Compact layout is used on very narrow sidebars. */
export function compactFor(budget: number, options: LayoutOptions = {}): boolean {
  return budget < (options.compactBelow ?? COMPACT_BELOW)
}

/** Width of the id/model column for a row budget: pay for the label, spaces
 * and provider tag first so the row cannot wrap onto a second line. */
export function columnFor(budget: number, wanted: number, options: LayoutOptions = {}): number {
  const maxColumn = options.maxColumn ?? MAX_COLUMN
  return Math.min(wanted, maxColumn, Math.max(6, budget - 18))
}
