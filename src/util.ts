/** Run `fn`, returning `fallback` when it throws. Used at host-boundary reads
 * where a missing or changed API must degrade instead of blanking the widget. */
export function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}
